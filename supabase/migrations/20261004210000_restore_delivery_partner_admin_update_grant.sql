-- Restore the authenticated table-level UPDATE privilege expected by the
-- partner registration and admin-review flows. This does not bypass RLS:
-- delivery_partners policies continue to restrict partners to their own row
-- and admins to authorized review operations, while guard_partner_columns()
-- protects privileged fields from partner self-edits.
GRANT UPDATE ON TABLE public.delivery_partners TO authenticated;
