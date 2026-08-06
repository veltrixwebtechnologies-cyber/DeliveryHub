-- 1) Vendors: remove public exposure of phone/address
DROP POLICY IF EXISTS "vendors readable" ON public.vendors;
REVOKE SELECT ON public.vendors FROM anon;
CREATE POLICY "vendors readable to authorized users"
ON public.vendors FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.vendor_id = vendors.id
      AND (
        public.is_my_partner(o.assigned_partner_id)
        OR (o.status = 'ready_for_pickup' AND o.assigned_partner_id IS NULL
            AND EXISTS (SELECT 1 FROM public.delivery_partners p
                        WHERE p.user_id = auth.uid()
                          AND p.status = 'approved'))
      )
  )
);

-- 2) Orders: stop WITH CHECK (true)
DROP POLICY IF EXISTS "orders update by vendor admin or assigned partner" ON public.orders;
CREATE POLICY "orders update by vendor admin or assigned partner"
ON public.orders FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = orders.vendor_id AND v.owner_id = auth.uid())
  OR public.is_my_partner(assigned_partner_id)
  OR (status = 'ready_for_pickup' AND assigned_partner_id IS NULL)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = orders.vendor_id AND v.owner_id = auth.uid())
  OR public.is_my_partner(assigned_partner_id)
);

-- Column-level guard for delivery partners updating orders
CREATE OR REPLACE FUNCTION public.guard_order_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if public.has_role(auth.uid(), 'admin')
     or exists (select 1 from public.vendors v where v.id = old.vendor_id and v.owner_id = auth.uid())
  then
    return new;
  end if;

  -- delivery partners may only progress the delivery, never edit order content
  new.order_code := old.order_code;
  new.vendor_id := old.vendor_id;
  new.customer_name := old.customer_name;
  new.customer_phone := old.customer_phone;
  new.customer_address := old.customer_address;
  new.customer_latitude := old.customer_latitude;
  new.customer_longitude := old.customer_longitude;
  new.items := old.items;
  new.order_total := old.order_total;
  new.delivery_fee := old.delivery_fee;
  new.delivery_notes := old.delivery_notes;
  new.delivery_otp := old.delivery_otp;
  new.created_at := old.created_at;
  if old.assigned_partner_id is not null then
    new.assigned_partner_id := old.assigned_partner_id;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS guard_order_columns_trg ON public.orders;
CREATE TRIGGER guard_order_columns_trg
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_columns();

-- 3) Ratings: stop WITH CHECK (true)
DROP POLICY IF EXISTS "ratings insert" ON public.delivery_ratings;
CREATE POLICY "ratings insert by authorized users"
ON public.delivery_ratings FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.is_my_partner(partner_id)
  OR EXISTS (
    SELECT 1 FROM public.delivery_assignments a
    JOIN public.orders o ON o.id = a.order_id
    JOIN public.vendors v ON v.id = o.vendor_id
    WHERE a.id = delivery_ratings.assignment_id
      AND a.partner_id = delivery_ratings.partner_id
      AND v.owner_id = auth.uid()
  )
);

-- 4) SECURITY DEFINER functions: no anonymous/public execution
REVOKE EXECUTE ON FUNCTION public.accept_delivery_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.broadcast_delivery_request(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_delivery(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_my_partner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_partner_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_partner_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_order_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_delivery_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_delivery_request(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_delivery(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_partner(uuid) TO authenticated;
