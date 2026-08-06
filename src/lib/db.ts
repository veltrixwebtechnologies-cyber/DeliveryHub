import { supabase } from "@/integrations/supabase/client";

/**
 * Loosely-typed data client. Generated types are refreshed asynchronously after
 * migrations, so table queries go through this alias to stay build-safe.
 * Auth and Storage keep using the generated `supabase` client directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = supabase;
