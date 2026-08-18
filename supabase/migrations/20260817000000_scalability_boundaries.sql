-- DeliveryHub scalability boundaries.
-- Current location is a mutable operational value. Historical locations are
-- sampled, so delivery_locations does not become a GPS write-ahead log.

create index if not exists idx_assignments_order_status
  on public.delivery_assignments(order_id, status);
create index if not exists idx_assignments_pending_expiry
  on public.delivery_assignments(partner_id, expires_at)
  where status = 'pending';
create index if not exists idx_notifications_unread
  on public.delivery_notifications(partner_id, created_at desc)
  where is_read = false;
create index if not exists idx_locations_assignment_created
  on public.delivery_locations(assignment_id, created_at desc);
create index if not exists idx_orders_ready_unassigned
  on public.orders(status, created_at desc)
  where status = 'ready_for_pickup' and assigned_partner_id is null;

-- A completed assignment may produce one delivery-fee ledger entry only.
create unique index if not exists uq_delivery_earnings_delivery_fee_assignment
  on public.delivery_earnings(assignment_id)
  where assignment_id is not null and type = 'delivery_fee';

-- Broadcast retries are safe: notify/count only when the assignment was new.
create or replace function public.broadcast_delivery_request(_order_id uuid, _timeout_seconds int default 60)
returns int language plpgsql security definer set search_path = public as $$
declare
  _v record; _count int := 0; _p record; _dist numeric;
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

    if found then
      insert into public.delivery_notifications (partner_id, title, body, kind)
      values (_p.id, 'New delivery request', 'Pickup from ' || (select shop_name from public.vendors where id = _v.vendor_id), 'new_delivery');
      update public.delivery_partners set total_requests = total_requests + 1 where id = _p.id;
      _count := _count + 1;
    end if;
  end loop;
  return _count;
end; $$;

revoke execute on function public.broadcast_delivery_request(uuid, integer) from public, anon;
grant execute on function public.broadcast_delivery_request(uuid, integer) to authenticated;

create or replace function public.submit_partner_location(
  _latitude double precision,
  _longitude double precision,
  _accuracy_m double precision default null,
  _captured_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _partner_id uuid;
  _assignment_id uuid;
begin
  if _latitude is null or _longitude is null
     or _latitude not between -90 and 90
     or _longitude not between -180 and 180 then
    raise exception 'Invalid location coordinates';
  end if;

  select id into _partner_id
  from public.delivery_partners
  where user_id = auth.uid()
    and status = 'approved'
    and availability = 'online'
  for update;

  if _partner_id is null then
    raise exception 'Partner is not online';
  end if;

  update public.delivery_partners
  set current_latitude = _latitude,
      current_longitude = _longitude,
      location_updated_at = now()
  where id = _partner_id;

  select id into _assignment_id
  from public.delivery_assignments
  where partner_id = _partner_id
    and status in ('accepted','navigating_to_vendor','reached_vendor','picked_up','out_for_delivery')
  order by updated_at desc
  limit 1;

  -- Keep a useful breadcrumb trail without persisting every browser watch
  -- callback. The current-location row above remains fresh for dispatch.
  if not exists (
    select 1 from public.delivery_locations
    where partner_id = _partner_id
      and created_at > now() - interval '30 seconds'
      and assignment_id is not distinct from _assignment_id
  ) then
    insert into public.delivery_locations(partner_id, assignment_id, latitude, longitude)
    values (_partner_id, _assignment_id, _latitude, _longitude);
  end if;
end;
$$;

revoke execute on function public.submit_partner_location(double precision, double precision, double precision, timestamptz)
  from public, anon;
grant execute on function public.submit_partner_location(double precision, double precision, double precision, timestamptz)
  to authenticated;

-- Retried completion requests are successful no-ops after the first commit.
create or replace function public.complete_delivery(_assignment_id uuid, _proof_type text, _proof_value text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _a record; _o record; _fee numeric;
begin
  select * into _a from public.delivery_assignments where id = _assignment_id for update;
  if _a is null or not public.is_my_partner(_a.partner_id) then raise exception 'Not allowed'; end if;
  if _a.status = 'delivered' then return; end if;
  if _a.status not in ('picked_up','out_for_delivery') then raise exception 'Delivery is not ready to complete'; end if;

  select * into _o from public.orders where id = _a.order_id;
  if _proof_type = 'otp' and coalesce(_proof_value,'') <> _o.delivery_otp then
    raise exception 'Incorrect delivery OTP';
  end if;
  _fee := coalesce(_a.estimated_earning, _o.delivery_fee);

  update public.delivery_assignments
    set status = 'delivered', delivered_at = now(), proof_type = _proof_type, proof_value = _proof_value
    where id = _assignment_id;
  update public.orders set status = 'delivered', delivered_at = now() where id = _a.order_id;
  insert into public.delivery_tracking (assignment_id, status, note)
    values (_assignment_id, 'delivered', 'Delivered to customer');
  insert into public.delivery_earnings (partner_id, assignment_id, type, amount, description)
    values (_a.partner_id, _assignment_id, 'delivery_fee', _fee, 'Delivery ' || _o.order_code);
  update public.delivery_partners set total_deliveries = total_deliveries + 1 where id = _a.partner_id;
  insert into public.delivery_notifications (partner_id, title, body, kind)
    values (_a.partner_id, 'Payment credited', '₹' || _fee || ' added to your earnings', 'payment_received');
end;
$$;

revoke execute on function public.complete_delivery(uuid, text, text) from public, anon;
grant execute on function public.complete_delivery(uuid, text, text) to authenticated;
