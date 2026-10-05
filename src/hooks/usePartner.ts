import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getPartnerForDashboard } from "@/repositories/partnerRepository";
import type { SafePartner } from "@/types/domain";

export function useSessionUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  return user;
}

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

export function useIsAdmin() {
  const user = useSessionUser();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Gate this admin area by the same explicit capability used by the
      // delivery-partner review RPC; do not infer access from UI role labels.
      const { data: allowed, error } = await supabase.rpc("has_admin_permission", {
        p_permission: "delivery_partners.manage",
      });
      if (error) throw error;
      return allowed === true;
    },
  });
}
