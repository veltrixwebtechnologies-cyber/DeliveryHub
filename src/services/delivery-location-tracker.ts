import { supabase } from "@/integrations/supabase/client";
import { isValidCoordinate } from "@/lib/geo";

export interface GPSPosition {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
}

interface QueuedLocationUpdate {
  assignmentId: string | null;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = "localshore_location_offline_queue";

function getOfflineQueue(): QueuedLocationUpdate[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: QueuedLocationUpdate[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-50))); // Keep last 50 items max
  } catch {
    // ignore storage errors
  }
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class DeliveryLocationTracker {
  private watchId: number | null = null;
  private currentAssignmentId: string | null = null;
  private lastSentPosition: GPSPosition | null = null;
  private lastSentTime = 0;
  private isTracking = false;
  private isProcessingQueue = false;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.flushOfflineQueue());
    }
  }

  public startTracking(assignmentId: string | null = null) {
    this.currentAssignmentId = assignmentId;

    if (this.isTracking) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      console.warn("[GPS Tracker] Geolocation API not supported");
      return;
    }

    this.isTracking = true;
    console.info("[GPS Tracker] Starting active location tracking for assignment:", assignmentId);

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePositionUpdate(pos),
      (err) => console.warn("[GPS Tracker] Geolocation error", err.message),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000,
      },
    );
  }

  public updateAssignmentId(assignmentId: string | null) {
    this.currentAssignmentId = assignmentId;
  }

  public stopTracking() {
    if (this.watchId !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.currentAssignmentId = null;
    console.info("[GPS Tracker] Location tracking stopped");
  }

  private async handlePositionUpdate(position: GeolocationPosition) {
    const now = Date.now();
    const { latitude, longitude, heading, speed, accuracy } = position.coords;

    if (!isValidCoordinate(latitude, longitude)) {
      return;
    }

    const newPos: GPSPosition = {
      latitude,
      longitude,
      heading: heading ?? 0,
      speed: speed ?? 0,
      accuracy: accuracy ?? null,
      timestamp: now,
    };

    // Filter 1: Throttling (3 - 5 seconds minimum interval)
    if (now - this.lastSentTime < 3000) {
      return;
    }

    // Filter 2: Distance threshold (> 3 meters movement unless 15s elapsed)
    if (this.lastSentPosition) {
      const movedMeters = haversineDistanceMeters(
        this.lastSentPosition.latitude,
        this.lastSentPosition.longitude,
        latitude,
        longitude,
      );
      if (movedMeters < 3.0 && now - this.lastSentTime < 15000) {
        return;
      }
    }

    this.lastSentPosition = newPos;
    this.lastSentTime = now;

    await this.sendOrQueueLocation({
      assignmentId: this.currentAssignmentId,
      latitude,
      longitude,
      heading: heading ?? 0,
      speed: speed ?? 0,
      timestamp: now,
    });
  }

  private async sendOrQueueLocation(update: QueuedLocationUpdate) {
    if (!navigator.onLine) {
      const queue = getOfflineQueue();
      queue.push(update);
      saveOfflineQueue(queue);
      console.info("[GPS Tracker] Offline. Queued location update.");
      return;
    }

    try {
      if (update.assignmentId) {
        const { error } = await supabase.rpc("update_delivery_location", {
          _assignment_id: update.assignmentId,
          _latitude: update.latitude,
          _longitude: update.longitude,
          _heading: update.heading,
          _speed: update.speed,
        });
        if (error) throw error;
      } else {
        await supabase.rpc("submit_partner_location", {
          _latitude: update.latitude,
          _longitude: update.longitude,
          _accuracy_m: null,
          _captured_at: new Date(update.timestamp).toISOString(),
        });
      }
    } catch (err) {
      console.warn("[GPS Tracker] Location submission failed. Queuing offline.", err);
      const queue = getOfflineQueue();
      queue.push(update);
      saveOfflineQueue(queue);
    }
  }

  public async flushOfflineQueue() {
    if (this.isProcessingQueue || !navigator.onLine) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    this.isProcessingQueue = true;
    console.info(`[GPS Tracker] Flushing ${queue.length} queued offline updates...`);

    const remaining: QueuedLocationUpdate[] = [];

    for (const item of queue) {
      try {
        if (item.assignmentId) {
          await supabase.rpc("update_delivery_location", {
            _assignment_id: item.assignmentId,
            _latitude: item.latitude,
            _longitude: item.longitude,
            _heading: item.heading,
            _speed: item.speed,
          });
        }
      } catch {
        remaining.push(item);
      }
    }

    saveOfflineQueue(remaining);
    this.isProcessingQueue = false;
    console.info("[GPS Tracker] Offline queue flush finished.");
  }
}

export const deliveryTracker = new DeliveryLocationTracker();
