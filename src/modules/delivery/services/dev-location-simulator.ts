/**
 * DevLocationSimulator - DEVELOPMENT ONLY
 *
 * Simulates driver GPS movement along a route with configurable:
 * - Speed (km/h)
 * - Movement update frequency
 * - GPS noise / accuracy jitter
 * - Network disconnect / reconnect simulation
 * - Out-of-order timestamp injection for testing server guards
 * - Off-route deviation
 */

import { supabase } from "@/integrations/supabase/client";

export interface SimulatorOptions {
  assignmentId: string;
  speedKmh?: number;
  intervalMs?: number;
  gpsNoiseMeters?: number;
  simulateOutofOrder?: boolean;
  onPositionEmitted?: (pos: { lat: number; lng: number; capturedAt: string }) => void;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

// Sample test route in Coimbatore (Gandhipuram -> RS Puram -> Customer)
export const DEMO_COIMBATORE_ROUTE: RoutePoint[] = [
  { lat: 11.0168, lng: 76.9558 }, // Gandhipuram Cross Cut Rd
  { lat: 11.015, lng: 76.958 },
  { lat: 11.012, lng: 76.96 },
  { lat: 11.009, lng: 76.957 },
  { lat: 11.0076, lng: 76.9537 }, // RS Puram DB Road
  { lat: 11.005, lng: 76.951 },
  { lat: 11.002, lng: 76.949 }, // Customer Destination
];

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

class DevLocationSimulator {
  private activeInterval: any = null;
  private isSimulating = false;
  private currentStepIndex = 0;

  public isRunning(): boolean {
    return this.isSimulating;
  }

  public start(options: SimulatorOptions) {
    if (typeof window !== "undefined") {
      const isLocalHost =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (!isLocalHost && !import.meta.env.DEV) {
        console.warn("[DevSimulator] Simulator is disabled in production environment.");
        return;
      }
    }

    this.stop();
    this.isSimulating = true;
    this.currentStepIndex = 0;

    const route = DEMO_COIMBATORE_ROUTE;
    const intervalMs = options.intervalMs ?? 3000;
    const speedKmh = options.speedKmh ?? 30;

    console.info(
      `[DevSimulator] Started live route simulation for assignment ${options.assignmentId} (${speedKmh} km/h, ${intervalMs}ms interval)`,
    );

    this.activeInterval = setInterval(async () => {
      if (!this.isSimulating || this.currentStepIndex >= route.length) {
        this.stop();
        return;
      }

      const point = route[this.currentStepIndex];
      if (!point) return;
      const nextPoint = route[Math.min(this.currentStepIndex + 1, route.length - 1)];

      let heading = 0;
      if (nextPoint && (nextPoint.lat !== point.lat || nextPoint.lng !== point.lng)) {
        heading = calculateBearing(point.lat, point.lng, nextPoint.lat, nextPoint.lng);
      }

      // Optional GPS jitter
      let lat = point.lat;
      let lng = point.lng;
      if (options.gpsNoiseMeters && options.gpsNoiseMeters > 0) {
        const jitterLat = (Math.random() - 0.5) * (options.gpsNoiseMeters / 111000);
        const jitterLng = (Math.random() - 0.5) * (options.gpsNoiseMeters / 111000);
        lat += jitterLat;
        lng += jitterLng;
      }

      let capturedAt = new Date().toISOString();

      // Test option: Inject out-of-order timestamp from 2 minutes ago
      if (options.simulateOutofOrder && this.currentStepIndex === 2) {
        capturedAt = new Date(Date.now() - 120000).toISOString();
        console.warn("[DevSimulator] Injecting simulated out-of-order timestamp:", capturedAt);
      }

      try {
        const { data, error } = await (supabase as any).rpc("update_delivery_location", {
          _assignment_id: options.assignmentId,
          _latitude: lat,
          _longitude: lng,
          _heading: heading,
          _speed: speedKmh / 3.6,
          _captured_at: capturedAt,
          _accuracy_m: options.gpsNoiseMeters ?? 10,
        });

        if (error) {
          console.error("[DevSimulator] Location update failed:", error);
        } else {
          console.info("[DevSimulator] Location update result:", data);
        }

        if (options.onPositionEmitted) {
          options.onPositionEmitted({ lat, lng, capturedAt });
        }
      } catch (err) {
        console.error("[DevSimulator] Simulation exception:", err);
      }

      this.currentStepIndex++;
    }, intervalMs);
  }

  public stop() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
    this.isSimulating = false;
    console.info("[DevSimulator] Live simulation stopped.");
  }
}

export const devSimulator = new DevLocationSimulator();
