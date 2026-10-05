-- Keep the online-partner offer-claim and assignment-history queries bounded
-- as orders and delivery assignments accumulate. The candidate index includes
-- every unassigned order status considered by claim_next_delivery_offer(), not
-- only ready_for_pickup rows.
CREATE INDEX IF NOT EXISTS idx_orders_dispatch_candidates
  ON public.orders (status, created_at)
  WHERE assigned_partner_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_partner_status_expiry_created
  ON public.delivery_assignments (partner_id, status, expires_at, created_at DESC);
