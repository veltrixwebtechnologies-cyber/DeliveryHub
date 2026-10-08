import { supabase } from "@/integrations/supabase/client";

export async function acceptDelivery(assignmentId: string) {
  const { data, error } = await supabase.rpc("accept_delivery_request", {
    _assignment_id: assignmentId,
  });
  if (error) throw error;
  return data;
}

export async function rejectDelivery(assignmentId: string) {
  const { error } = await supabase.rpc("reject_delivery_request", {
    _assignment_id: assignmentId,
  });
  if (error) throw error;
}

export async function claimNextDeliveryOffer() {
  const { error } = await supabase.rpc("claim_next_delivery_offer");
  if (error) throw error;
}

export async function goOffline() {
  const { error } = await supabase.rpc("partner_go_offline");
  if (error) throw error;
}
