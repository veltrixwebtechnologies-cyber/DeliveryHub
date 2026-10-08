import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { LocalShoreRole, RoleStatus } from "@/types/roles";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/shared/auth/session";

export function useRoles() {
  const user = useSessionUser();
  const query = useQuery({
    queryKey: ["localshore-roles", user?.id],
    enabled: Boolean(user),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("role,status")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((row: { role: string; status?: string | null }) => ({
        role: String(row.role) as LocalShoreRole,
        status: String(row.status ?? "active") as RoleStatus,
      }));
    },
  });
  const roles = useMemo(
    () => query.data?.map((row: { role: LocalShoreRole }) => row.role) ?? [],
    [query.data],
  );
  return {
    ...query,
    roles,
    hasRole: (role: LocalShoreRole) => roles.includes(role),
    hasActiveRole: (role: LocalShoreRole) =>
      query.data?.some(
        (row: { role: LocalShoreRole; status: RoleStatus }) =>
          row.role === role && row.status === "active",
      ) ?? false,
  };
}
