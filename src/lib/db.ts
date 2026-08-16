import { supabase } from "@/integrations/supabase/client";

/**
 * Loosely-typed data client. Generated types are refreshed asynchronously after
 * migrations, so table queries go through this alias to stay build-safe.
 * Auth and Storage keep using the generated `supabase` client directly.
 */

export const db: any = supabase;
