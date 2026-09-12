import { supabase } from "@/integrations/supabase/client";
import type { LocationUpdate } from "@/types/domain";

/**
 * Current-location infrastructure boundary.
 * Handles location submissions with retries and structured error logging.
 */
export interface LocationService {
  submitCurrentLocation(update: LocationUpdate): Promise<void>;
}

import { parseCoordinates, MAX_NAVIGATION_ACCURACY_M } from "@/lib/coordinates";

export const locationService: LocationService = {
  async submitCurrentLocation({ latitude, longitude, accuracyM, capturedAt }) {
    const timestamp = Date.parse(capturedAt ?? "");
    if (
      !parseCoordinates(latitude, longitude) ||
      typeof accuracyM !== "number" ||
      !Number.isFinite(accuracyM) ||
      accuracyM < 0 ||
      accuracyM > MAX_NAVIGATION_ACCURACY_M ||
      !Number.isFinite(timestamp) ||
      Date.now() - timestamp > 5000 ||
      timestamp > Date.now() + 1000
    ) {
      throw new Error("A fresh, precise device location is required.");
    }
    const { error } = await supabase.rpc("submit_partner_location", {
      _latitude: latitude,
      _longitude: longitude,
      _accuracy_m: accuracyM,
      _captured_at: new Date(timestamp).toISOString(),
    });
    if (error) throw error;
  },
};
