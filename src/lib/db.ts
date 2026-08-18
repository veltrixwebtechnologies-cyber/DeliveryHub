import { supabase } from "@/integrations/supabase/client";

/**
 * Legacy query escape hatch for screens that depend on tables not represented
 * in the checked-in schema snapshot yet. New business-critical operations must
 * use a typed repository/service instead of this compatibility boundary.
 */
export const db: any = supabase;
