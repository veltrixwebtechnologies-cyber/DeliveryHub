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
    try {
      const { error } = await supabase.rpc("submit_partner_location", {
        _latitude: latitude,
        _longitude: longitude,
        _accuracy_m: accuracyM ?? null,
        _captured_at: capturedAt ?? new Date().toISOString(),
      });
      if (error) {
        logStructuredError("LocationServiceRPC", error, { latitude, longitude });
      }
    } catch (err) {
      logStructuredError("LocationServiceNetwork", err, { latitude, longitude });
    }
  },
};
