-- Expired pending offers must not block a partner from claiming the next order.
-- The partner UI intentionally ignores offers whose expires_at is in the past;
-- without this cleanup, claim_next_delivery_offer could keep returning a stale
-- pending assignment forever and never create a visible request.

-- The legacy assignment guard freezes expires_at for partner-originated writes.
-- Permit the trusted claim RPC to refresh only the assignment owned by the
-- partner it resolved from auth.uid(); the marker is transaction-local and
-- cannot be set through the PostgREST table-update API.
CREATE OR REPLACE FUNCTION public.guard_assignment_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR current_setting('localshore.claim_next_delivery_offer_partner_id', true)
        = OLD.partner_id::text THEN
    RETURN NEW;
  END IF;

  NEW.order_id := OLD.order_id;
  NEW.partner_id := OLD.partner_id;
  NEW.estimated_earning := OLD.estimated_earning;
  NEW.distance_km := OLD.distance_km;
  NEW.expires_at := OLD.expires_at;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_delivery_offer()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p_id uuid;
  o record;
  a record;
BEGIN
  SELECT id INTO p_id
  FROM public.delivery_partners
  WHERE user_id = auth.uid()
    AND status::text = 'approved'
    AND availability = 'online';

  IF p_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Partner not active or online');
  END IF;

  PERFORM set_config('localshore.claim_next_delivery_offer_partner_id', p_id::text, true);

  -- Clear pending offers that the client has already stopped displaying.
  UPDATE public.delivery_assignments
  SET status = 'expired'
  WHERE partner_id = p_id
    AND status::text IN ('pending', 'requested')
    AND (expires_at IS NULL OR expires_at <= now());

  -- Keep a live offer or active delivery; never let expired pending rows match.
  SELECT * INTO a
  FROM public.delivery_assignments
  WHERE partner_id = p_id
    AND (
      (status::text IN ('pending', 'requested') AND expires_at > now())
      OR status::text IN (
        'accepted', 'navigating_to_vendor', 'reached_vendor', 'picked_up', 'out_for_delivery'
      )
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF a.id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'assignment_id', a.id, 'status', a.status);
  END IF;

  SELECT candidate.* INTO o
  FROM public.orders candidate
  WHERE candidate.status::text IN ('new', 'accepted', 'preparing', 'packed', 'ready_for_pickup')
    AND candidate.assigned_partner_id IS NULL
  ORDER BY candidate.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF o.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No orders available');
  END IF;

  INSERT INTO public.delivery_assignments (
    order_id, partner_id, status, distance_km, estimated_earning, expires_at
  ) VALUES (
    o.id, p_id, 'pending', 2.0, COALESCE(o.shipping_fee, 25.00) + 10.00,
    now() + interval '5 minutes'
  )
  ON CONFLICT (order_id, partner_id) DO UPDATE
    SET status = 'pending', expires_at = excluded.expires_at
  RETURNING * INTO a;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', a.id,
    'order_id', o.id,
    'status', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_delivery_offer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_next_delivery_offer() TO authenticated;

NOTIFY pgrst, 'reload schema';
