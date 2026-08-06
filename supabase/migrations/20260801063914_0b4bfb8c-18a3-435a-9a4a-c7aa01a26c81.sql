
-- broadcast a ready order to nearby online approved partners
create or replace function public.broadcast_delivery_request(_order_id uuid, _timeout_seconds int default 60)
returns int language plpgsql security definer set search_path = public as $$
declare _v record; _count int := 0; _p record; _dist numeric;
begin
  select o.*, v.latitude as vlat, v.longitude as vlng into _v
  from public.orders o join public.vendors v on v.id = o.vendor_id where o.id = _order_id;
  if _v is null or _v.status <> 'ready_for_pickup' or _v.assigned_partner_id is not null then return 0; end if;

  for _p in
    select p.id,
      (6371 * acos(least(1, greatest(-1,
        cos(radians(_v.vlat)) * cos(radians(coalesce(p.current_latitude, _v.vlat))) *
        cos(radians(coalesce(p.current_longitude, _v.vlng)) - radians(_v.vlng)) +
        sin(radians(_v.vlat)) * sin(radians(coalesce(p.current_latitude, _v.vlat)))
      )))) as distance_km,
      p.rating,
      (select count(*) from public.delivery_assignments a
        where a.partner_id = p.id and a.status in ('accepted','navigating_to_vendor','reached_vendor','picked_up','out_for_delivery')) as active_orders
    from public.delivery_partners p
    where p.status = 'approved' and p.availability = 'online'
    order by distance_km asc, active_orders asc, p.rating desc
    limit 10
  loop
    _dist := round(_p.distance_km::numeric, 2);
    insert into public.delivery_assignments (order_id, partner_id, distance_km, estimated_earning, expires_at)
    values (_order_id, _p.id, _dist, round(_v.delivery_fee + (_dist * 4), 2), now() + make_interval(secs => _timeout_seconds))
    on conflict (order_id, partner_id) do nothing;

    insert into public.delivery_notifications (partner_id, title, body, kind)
    values (_p.id, 'New delivery request', 'Pickup from ' || (select shop_name from public.vendors where id = _v.vendor_id), 'new_delivery');

    update public.delivery_partners set total_requests = total_requests + 1 where id = _p.id;
    _count := _count + 1;
  end loop;
  return _count;
end; $$;
revoke execute on function public.broadcast_delivery_request(uuid,int) from anon;

-- first accept wins
create or replace function public.accept_delivery_request(_assignment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _a record;
begin
  select * into _a from public.delivery_assignments where id = _assignment_id for update;
  if _a is null then raise exception 'Request not found'; end if;
  if not public.is_my_partner(_a.partner_id) then raise exception 'Not your request'; end if;
  if _a.status <> 'pending' then raise exception 'Request no longer available'; end if;
  if _a.expires_at < now() then
    update public.delivery_assignments set status = 'expired' where id = _assignment_id;
    raise exception 'Request expired';
  end if;

  update public.orders set status = 'assigned', assigned_partner_id = _a.partner_id
    where id = _a.order_id and assigned_partner_id is null;
  if not found then raise exception 'Another partner already accepted this order'; end if;

  update public.delivery_assignments set status = 'accepted', responded_at = now() where id = _assignment_id;
  update public.delivery_assignments set status = 'expired'
    where order_id = _a.order_id and id <> _assignment_id and status = 'pending';
  update public.delivery_partners set accepted_requests = accepted_requests + 1 where id = _a.partner_id;
  insert into public.delivery_tracking (assignment_id, status, note) values (_assignment_id, 'accepted', 'Rider accepted the request');
  return _assignment_id;
end; $$;
revoke execute on function public.accept_delivery_request(uuid) from anon;

-- complete delivery: proof + earning + stats
create or replace function public.complete_delivery(_assignment_id uuid, _proof_type text, _proof_value text)
returns void language plpgsql security definer set search_path = public as $$
declare _a record; _o record; _fee numeric;
begin
  select * into _a from public.delivery_assignments where id = _assignment_id;
  if _a is null or not public.is_my_partner(_a.partner_id) then raise exception 'Not allowed'; end if;
  select * into _o from public.orders where id = _a.order_id;
  if _proof_type = 'otp' and coalesce(_proof_value,'') <> _o.delivery_otp then
    raise exception 'Incorrect delivery OTP';
  end if;
  _fee := coalesce(_a.estimated_earning, _o.delivery_fee);

  update public.delivery_assignments
    set status = 'delivered', delivered_at = now(), proof_type = _proof_type, proof_value = _proof_value
    where id = _assignment_id;
  update public.orders set status = 'delivered', delivered_at = now() where id = _a.order_id;
  insert into public.delivery_tracking (assignment_id, status, note) values (_assignment_id, 'delivered', 'Delivered to customer');
  insert into public.delivery_earnings (partner_id, assignment_id, type, amount, description)
    values (_a.partner_id, _assignment_id, 'delivery_fee', _fee, 'Delivery ' || _o.order_code);
  update public.delivery_partners set total_deliveries = total_deliveries + 1 where id = _a.partner_id;
  insert into public.delivery_notifications (partner_id, title, body, kind)
    values (_a.partner_id, 'Payment credited', '₹' || _fee || ' added to your earnings', 'payment_received');
end; $$;
revoke execute on function public.complete_delivery(uuid,text,text) from anon;
