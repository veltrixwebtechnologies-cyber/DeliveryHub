import { supabase } from "@/integrations/supabase/client";
import type { LocationUpdate } from "@/types/domain";

/**
 * Current-location infrastructure boundary. The first implementation remains
 * Supabase/RPC-backed; a realtime/geo store can replace it without changing
 * browser or mobile feature code.
 */
export interface LocationService {
  submitCurrentLocation(update: LocationUpdate): Promise<void>;
}

export const locationService: LocationService = {
  async submitCurrentLocation({ latitude, longitude, accuracyM, capturedAt }) {
    const { error } = await supabase.rpc("submit_partner_location", {
      _latitude: latitude,
      _longitude: longitude,
      _accuracy_m: accuracyM ?? null,
      _captured_at: capturedAt ?? new Date().toISOString(),
    });
    if (error) throw error;
  },
};
