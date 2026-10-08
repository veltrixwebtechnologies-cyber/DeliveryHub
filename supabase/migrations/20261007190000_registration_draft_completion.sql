-- Forward-only onboarding correction. Review deployed grants/functions before applying.
-- Does not grant approval or access to another partner's rows; existing RLS remains.
BEGIN;
ALTER TABLE public.delivery_partners ADD COLUMN IF NOT EXISTS insurance_expiry date;
GRANT UPDATE (insurance_expiry) ON public.delivery_partners TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_partner_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
  -- Nine is the working-preferences screen, not a submitted application.
  IF OLD.status IN ('draft', 'info_requested') AND NEW.registration_step >= 10 THEN
    NEW.status := 'pending_verification';
  END IF;
  IF NEW.availability <> 'offline' AND OLD.status <> 'approved' THEN
    NEW.availability := 'offline';
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
