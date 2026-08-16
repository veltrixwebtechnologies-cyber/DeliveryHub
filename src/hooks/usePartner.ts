/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase RPC compatibility across deployed schemas. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

export type Partner = {
  id: string;
  user_id: string;
  full_name: string;
  mobile: string;
  email: string;
  mobile_verified: boolean;
  email_verified: boolean;
  profile_photo_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  house_number: string | null;
  street: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  licence_number: string | null;
  licence_expiry: string | null;
  aadhaar_number: string | null;
  pan_number: string | null;
  bank_account_holder: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
  employment_type: string | null;
  status: string;
  admin_note: string | null;
  registration_step: number;
  availability: string;
  current_latitude: number | null;
  current_longitude: number | null;
  rating: number;
  total_deliveries: number;
  cancelled_deliveries: number;
  late_deliveries: number;
  total_requests: number;
  accepted_requests: number;
  approved_at: string | null;
  created_at: string;
};

export function usePartner() {
  const user = useSessionUser();
  const query = useQuery({
    queryKey: ["partner", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_partners")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Partner) ?? null;
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
      const { data: roleCheck, error: roleError } = await (supabase as any).rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (!roleError) return roleCheck === true;

      // Compatibility fallback for older projects that have not deployed the
      // public helper yet.
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw roleError ?? error;
      return !!data;
    },
  });
}
