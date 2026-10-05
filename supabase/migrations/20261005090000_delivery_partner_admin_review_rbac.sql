-- Admin review writes use a permission-checked SECURITY DEFINER RPC.
-- PREPARED — DATABASE VERIFICATION PENDING. Do not apply to Production.

DO $preflight$
BEGIN
  IF to_regclass('public.delivery_partners') IS NULL
     OR to_regprocedure('public.has_admin_permission(text)') IS NULL
     OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL
     OR to_regclass('public.admin_audit_logs') IS NULL
     OR to_regclass('public.admin_access_assignments') IS NULL THEN
    RAISE EXCEPTION 'Delivery partner review requires delivery_partners and Phase A RBAC/audit infrastructure';
  END IF;
END;
$preflight$;

-- Keep the partner's established profile-edit columns, but remove the broad
-- table-level UPDATE privilege that allowed direct approval/status writes.
REVOKE UPDATE ON TABLE public.delivery_partners FROM authenticated;
GRANT UPDATE (
  full_name, mobile, email, mobile_verified, email_verified,
  profile_photo_url, date_of_birth, gender, emergency_contact_name,
  emergency_contact_number, house_number, street, area, city, state, pincode,
  vehicle_type, vehicle_number, vehicle_brand, vehicle_model, vehicle_color,
  licence_number, licence_expiry, aadhaar_number, pan_number,
  bank_account_holder, bank_name, bank_account_number, bank_ifsc, upi_id,
  employment_type, registration_step, availability
) ON public.delivery_partners TO authenticated;

-- Preserve the existing self-edit protections while allowing authorized
-- dispatch managers to perform approval via the RPC below.
CREATE OR REPLACE FUNCTION public.guard_partner_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_admin_permission('dispatch.manage') THEN
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
    OR public.has_admin_permission('dispatch.manage')
  ) THEN
    RAISE EXCEPTION 'Not authorized to review delivery partners' USING ERRCODE = '42501';
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

  RETURN jsonb_build_object(
    'id', _partner_id,
    'status', _status,
    'approved_at', v_approved_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_delivery_partner(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_delivery_partner(uuid, text, text) TO authenticated;
