-- Store the insurance expiry date entered during partner onboarding.
ALTER TABLE public.delivery_partners
  ADD COLUMN IF NOT EXISTS insurance_expiry date;

