import { useEffect, useState } from "react";

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { withRequestTimeout } from "@/shared/request-timeout";

export function useSessionState() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    let authChanged = false;
    setError("");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      if (!active) return;
      setError("");
      setUser(session?.user ?? null);
    });
    void withRequestTimeout(supabase.auth.getSession())
      .then(({ data, error: sessionError }) => {
        if (!active || authChanged) return;
        if (sessionError) throw sessionError;
        setUser(data.session?.user ?? null);
      })
      .catch((reason) => {
        if (active && !authChanged) setError(reason.message);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [revision]);

  return { user, error, retry: () => setRevision((value) => value + 1) };
}

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
