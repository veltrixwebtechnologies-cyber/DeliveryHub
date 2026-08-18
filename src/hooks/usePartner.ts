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
  });

  return {
    user,
    partner: query.data ?? null,
    isLoading: user === undefined || (!!user && query.isLoading),
    signedOut: user === null,
    refetch: query.refetch,
  };
}

export function useIsAdmin() {
  const user = useSessionUser();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Prefer the SECURITY DEFINER role helper. It avoids exposing a direct
      // user_roles REST read and remains valid when production RLS differs
      // from the local schema.
      const { data: roleCheck, error: roleError } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (roleError) throw roleError;
      return roleCheck === true;
    },
  });
}
