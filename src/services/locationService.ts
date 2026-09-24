import { supabase } from "@/integrations/supabase/client";
import type { LocationUpdate } from "@/types/domain";
import { logStructuredError } from "@/lib/error-capture";

/**
 * Current-location infrastructure boundary.
 * Handles location submissions with retries and structured error logging.
 */
export interface LocationService {
  submitCurrentLocation(update: LocationUpdate): Promise<void>;
}

export const locationService: LocationService = {
  async submitCurrentLocation({ latitude, longitude, accuracyM, capturedAt }) {
    const timestamp = capturedAt ?? new Date().toISOString();
    let rpcSuccess = false;

    try {
      const { error } = await supabase.rpc("submit_partner_location", {
        _latitude: latitude,
        _longitude: longitude,
        _accuracy_m: accuracyM ?? null,
        _captured_at: timestamp,
      });
      if (!error) {
        rpcSuccess = true;
      } else {
        logStructuredError("LocationServiceRPC", error, { latitude, longitude });
      }
    } catch (err) {
      logStructuredError("LocationServiceNetwork", err, { latitude, longitude });
    }

    // Always mirror the fresh partner fix onto active assignments. The Users
    // app reads delivery_assignments, while the partner dashboard reads the
    // partner row. Updating only the partner row leaves customer tracking
    // stale until the rider opens the active delivery screen.
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      const partnerQuery = supabase
        .from("delivery_partners")
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          location_updated_at: timestamp,
        })
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      const { data: partner, error: partnerError } = await partnerQuery;
      if (partnerError || !partner?.id) return;

      const { error: assignmentError } = await supabase
        .from("delivery_assignments")
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          last_location_at: timestamp,
          last_location_update_at: timestamp,
        } as any)
        .eq("partner_id", partner.id)
        .in("status", [
          "accepted",
          "navigating_to_vendor",
          "reached_vendor",
          "picked_up",
          "out_for_delivery",
        ]);
      if (assignmentError) {
        console.warn("[LocationService] Assignment location sync failed:", assignmentError);
      }
    } catch (syncError) {
      console.warn("[LocationService] Location mirror update failed:", syncError);
    }
  },
};
