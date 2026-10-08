import { supabase } from "@/integrations/supabase/client";
import type { SafePartner } from "@/types/domain";

export const SAFE_PARTNER_SELECT =
  "id,user_id,full_name,mobile,email,mobile_verified,email_verified,profile_photo_url,date_of_birth,gender,emergency_contact_number,house_number,street,area,city,state,pincode,vehicle_type,vehicle_number,vehicle_brand,vehicle_model,vehicle_color,employment_type,status,admin_note,registration_step,availability,current_latitude,current_longitude,location_updated_at,rating,total_deliveries,cancelled_deliveries,late_deliveries,total_requests,accepted_requests,approved_at,created_at" as const;

export async function getPartnerForDashboard(userId: string): Promise<SafePartner | null> {
  const { data, error } = await supabase
    .from("delivery_partners")
    .select(SAFE_PARTNER_SELECT)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setPartnerAvailability(
  partnerId: string,
  availability: "online" | "offline",
) {
  const { error } = await supabase
    .from("delivery_partners")
    .update({ availability })
    .eq("id", partnerId);
  if (error) throw error;
}
