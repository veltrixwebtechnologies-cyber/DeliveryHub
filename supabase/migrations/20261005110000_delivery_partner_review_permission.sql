-- Align delivery-partner review with an explicit least-privilege RBAC capability.
-- PREPARED — DATABASE VERIFICATION PENDING. Never apply to Production.

DO $preflight$
BEGIN
  IF to_regclass('public.admin_role_permissions') IS NULL
     OR to_regclass('public.admin_access_assignments') IS NULL
     OR to_regclass('public.delivery_partners') IS NULL
     OR to_regprocedure('public.has_admin_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Delivery partner review permission requires Phase A RBAC and delivery partner tables';
  END IF;
END;
$preflight$;

INSERT INTO public.admin_role_permissions (role, permission)
VALUES
  ('SUPER_ADMIN', 'delivery_partners.manage'),
  ('OPERATIONS_ADMIN', 'delivery_partners.manage')
ON CONFLICT (role, permission) DO NOTHING;

CREATE OR REPLACE FUNCTION public.guard_partner_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_admin_permission('delivery_partners.manage') THEN
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  NEW.approved_at := OLD.approved_at;
  NEW.admin_note := OLD.admin_note;
  NEW.rating := OLD.rating;
  NEW.total_deliveries := OLD.total_deliveries;
  NEW.cancelled_deliveries := OLD.cancelled_deliveries;
  NEW.late_deliveries := OLD.late_deliveries;
  NEW.total_requests := OLD.total_requests;
  NEW.accepted_requests := OLD.accepted_requests;
  IF OLD.status = 'draft' AND NEW.registration_step >= 9 THEN
    NEW.status := 'pending_verification';
  END IF;
  IF OLD.status = 'info_requested' THEN
    NEW.status := 'pending_verification';
  END IF;
  IF NEW.availability <> 'offline' AND OLD.status <> 'approved' THEN
    NEW.availability := 'offline';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_delivery_partner(
  _partner_id uuid,
  _status text,
  _admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_partner public.delivery_partners%ROWTYPE;
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_approved_at timestamptz;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_admin_permission('delivery_partners.manage')
  ) THEN
    RAISE EXCEPTION 'Not authorized to review delivery partners (requires delivery_partners.manage)' USING ERRCODE = '42501';
  END IF;

  IF _status NOT IN ('approved', 'rejected', 'info_requested', 'suspended') THEN
    RAISE EXCEPTION 'Invalid delivery partner review status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_partner
  FROM public.delivery_partners
  WHERE id = _partner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery partner not found' USING ERRCODE = 'P0002';
  END IF;

  v_approved_at := CASE
    WHEN _status = 'approved' THEN COALESCE(v_partner.approved_at, now())
    ELSE NULL
  END;

  UPDATE public.delivery_partners
  SET status = _status,
      admin_note = NULLIF(btrim(_admin_note), ''),
      approved_at = v_approved_at
  WHERE id = _partner_id;

  SELECT assignment.role INTO v_actor_role
  FROM public.admin_access_assignments assignment
  WHERE assignment.user_id = v_actor AND assignment.status = 'active'
  LIMIT 1;

  INSERT INTO public.admin_audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_value, new_value, reason, metadata
  ) VALUES (
    v_actor, COALESCE(v_actor_role, 'SUPER_ADMIN'),
    'DELIVERY_PARTNER_STATUS_CHANGED', 'delivery_partners', _partner_id::text,
    jsonb_build_object('status', v_partner.status),
    jsonb_build_object('status', _status, 'approved_at', v_approved_at),
    NULLIF(btrim(_admin_note), ''),
    jsonb_build_object('partner_id', _partner_id)
  );

  RETURN jsonb_build_object('id', _partner_id, 'status', _status, 'approved_at', v_approved_at);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_delivery_partner(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_delivery_partner(uuid, text, text) TO authenticated;
