// Compatibility exports for existing partner/vendor/admin routes.
export { useSessionUser } from "@/shared/auth/session";
export { usePartner } from "@/modules/delivery/hooks/usePartner";
export type { Partner } from "@/modules/delivery/hooks/usePartner";
export { useIsAdmin } from "@/shared/auth/delivery-admin";
