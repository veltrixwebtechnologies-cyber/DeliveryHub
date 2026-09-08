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

    // Direct table fallback if RPC returns an error or fails
    if (!rpcSuccess) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          const { data: partner } = await supabase
            .from("delivery_partners")
            .update({
              current_latitude: latitude,
              current_longitude: longitude,
              location_updated_at: timestamp,
            })
            .eq("user_id", userData.user.id)
            .select("id")
            .maybeSingle();

          if (partner?.id) {
            await supabase
              .from("delivery_assignments")
              .update({
                current_latitude: latitude,
                current_longitude: longitude,
                last_location_at: timestamp,
              } as any)
              .eq("partner_id", partner.id)
              .in("status", [
                "accepted",
                "navigating_to_vendor",
                "reached_vendor",
                "picked_up",
                "out_for_delivery",
              ]);
          }
        }
      } catch (fallbackErr) {
        console.warn("[LocationService] Fallback table update failed:", fallbackErr);
      }
    }
  },
};
