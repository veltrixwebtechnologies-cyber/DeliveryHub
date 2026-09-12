import { watchGPS } from "@/lib/gps-watch";
import { supabase } from "@/integrations/supabase/client";
import { usableGPS } from "@/lib/coordinates";

export interface GPSPosition {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
}

class DeliveryLocationTracker {
  private stopWatch: (() => void) | null = null;
  private currentAssignmentId: string | null = null;
  private lastSentAt = 0;
  private lastCapturedAt = 0;
  private sending = false;
  constructor() {
    if (typeof window !== "undefined")
      window.addEventListener("online", () => this.flushOfflineQueue());
  }
  public startTracking(assignmentId: string | null = null) {
    this.updateAssignmentId(assignmentId);
    if (this.stopWatch !== null || typeof navigator === "undefined" || !navigator.geolocation)
      return;
    this.stopWatch = watchGPS(
      (position) => {
        void this.submitPosition(position, this.currentAssignmentId);
      },
      (error) => console.warn("[GPS Tracker]", error.message),
    );
  }
  public updateAssignmentId(id: string | null) {
    if (this.currentAssignmentId !== id) {
      this.lastSentAt = 0;
      this.lastCapturedAt = 0;
    }
    this.currentAssignmentId = id;
  }
  public stopTracking() {
    if (this.stopWatch !== null && typeof navigator !== "undefined") this.stopWatch();
    this.stopWatch = null;
    this.currentAssignmentId = null;
  }
  public async submitPosition(position: GeolocationPosition, assignmentId: string | null) {
    if (
      !usableGPS(position) ||
      Date.now() - position.timestamp > 5000 ||
      !navigator.onLine ||
      this.sending
    )
      return false;
    this.updateAssignmentId(assignmentId);
    if (position.timestamp <= this.lastCapturedAt || Date.now() - this.lastSentAt < 3000)
      return false;
    this.sending = true;
    this.lastSentAt = Date.now();
    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    try {
      const result = assignmentId
        ? await supabase.rpc("update_delivery_location", {
            _assignment_id: assignmentId,
            _latitude: latitude,
            _longitude: longitude,
            _heading: Number.isFinite(heading) ? heading! : 0,
            _speed: Number.isFinite(speed) ? speed! : 0,
          })
        : await supabase.rpc("submit_partner_location", {
            _latitude: latitude,
            _longitude: longitude,
            _accuracy_m: accuracy,
            _captured_at: new Date(position.timestamp).toISOString(),
          });
      if (result.error) throw result.error;
      this.lastCapturedAt = position.timestamp;
      return true;
    } catch (error) {
      console.warn("[GPS Tracker] Location sync failed; a fresh fix will retry.", error);
      return false;
    } finally {
      this.sending = false;
    }
  }
  public flushOfflineQueue() {
    // The legacy RPC stamps positions with server time. Replaying history would
    // turn stale coordinates into a current position. Request a fresh fix instead.
    try {
      localStorage.removeItem("localshore_location_offline_queue");
    } catch {}
    if (this.stopWatch === null || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void this.submitPosition(position, this.currentAssignmentId);
      },
      (error) => console.warn("[GPS Tracker]", error.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }
}
export const deliveryTracker = new DeliveryLocationTracker();
