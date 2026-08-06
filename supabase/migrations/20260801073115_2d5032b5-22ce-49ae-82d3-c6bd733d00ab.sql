-- 1. Orders: remove the open "ready_for_pickup + unassigned" update branch
DROP POLICY IF EXISTS "orders update by vendor admin or assigned partner" ON public.orders;

CREATE POLICY "orders update by vendor admin or assigned partner"
ON public.orders FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = orders.vendor_id AND v.owner_id = auth.uid())
  OR public.is_my_partner(assigned_partner_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = orders.vendor_id AND v.owner_id = auth.uid())
  OR public.is_my_partner(assigned_partner_id)
);

-- 2. Attach the column guard trigger (it existed as a function but was never attached)
DROP TRIGGER IF EXISTS guard_order_columns_trg ON public.orders;
CREATE TRIGGER guard_order_columns_trg
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_columns();

-- 3. delivery_locations: make immutability explicit at the privilege level
REVOKE UPDATE, DELETE, TRUNCATE ON public.delivery_locations FROM authenticated, anon;
GRANT SELECT, INSERT ON public.delivery_locations TO authenticated;
GRANT ALL ON public.delivery_locations TO service_role;