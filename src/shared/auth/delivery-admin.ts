import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { useSessionUser } from "@/shared/auth/session";

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
