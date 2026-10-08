import { useQuery } from "@tanstack/react-query";

import { getPartnerForDashboard } from "@/modules/delivery/repositories/partnerRepository";
import type { SafePartner } from "@/types/domain";
import { useSessionUser } from "@/shared/auth/session";

export type Partner = SafePartner;
export function usePartner() {
  const user = useSessionUser();
  const query = useQuery({
    queryKey: ["partner", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return getPartnerForDashboard(user!.id);
    },
    retry: 1,
    retryDelay: 1_000,
    // Approval is an admin-side change. Poll as a fallback because Realtime
    // delivery can be unavailable when publication/RLS configuration differs.
    refetchInterval: user ? 10_000 : false,
    refetchOnWindowFocus: true,
  });

  return {
    user,
    partner: query.data ?? null,
    isLoading: user === undefined || (!!user && query.isLoading),
    signedOut: user === null,
    error: query.error,
    refetch: query.refetch,
  };
}
