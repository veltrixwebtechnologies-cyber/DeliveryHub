/**
 * NavigationBar — Turn-by-turn instruction overlay for delivery driver
 * 
 * Displays:
 * - Next maneuver direction (icon + text)
 * - Distance to next turn
 * - Road name
 * - Total route ETA & distance
 * - Phase indicator (vendor/customer)
 * - Arrival action prompts
 */

import { formatDistanceShort, formatDurationShort, getManeuverIcon } from "@/lib/delivery-routing";
import type { TurnStep, RouteResult } from "@/lib/delivery-routing";
import { Navigation, MapPin, Store, Locate, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { osmDirections } from "@/lib/delivery";
import type { NavigationPhase, ArrivalZone } from "@/hooks/useDriverNavigation";

interface NavigationBarProps {
  route: RouteResult | null;
  phase: NavigationPhase;
  nextStep: TurnStep | null;
  distanceToNextStep: number;
  distanceToDestM: number;
  etaSeconds: number;
  destinationLabel: string;
  destination: { lat: number; lng: number } | null;
  driverPos: { lat: number; lng: number } | null;
  arrivalZone: ArrivalZone;
  isOffRoute: boolean;
  isRerouting: boolean;
  isStale: boolean;
  accuracy: number | null;
  speed: number;
  followMode: boolean;
  onRecenter: () => void;
  onRefreshRoute: () => void;
}

export function NavigationBar({
  route,
  phase,
  nextStep,
  distanceToNextStep,
  distanceToDestM,
  etaSeconds,
  destinationLabel,
  destination,
  driverPos,
  arrivalZone,
  isOffRoute,
  isRerouting,
  isStale,
  accuracy,
  speed,
  followMode,
  onRecenter,
  onRefreshRoute,
}: NavigationBarProps) {
  const phaseColor = phase === "to_vendor" ? "#8B5CF6" : "#E3A72E";
  const phaseLabel = phase === "to_vendor" ? "Heading to Shop" : "Heading to Customer";
  const phaseEmoji = phase === "to_vendor" ? "🏪" : "🏠";

  const isArrived = arrivalZone === "at_vendor" || arrivalZone === "at_customer";
  const isNear = arrivalZone === "near_vendor" || arrivalZone === "near_customer";

  const externalNavUrl = destination && driverPos
    ? osmDirections([driverPos.lat, driverPos.lng], [destination.lat, destination.lng])
    : null;



  const speedKmh = Math.round((speed || 0) * 3.6);

  return (
    <div className="flex flex-col gap-0">
      {/* ── Turn-by-turn Instruction Card ── */}
      {nextStep && !isArrived && (
        <div
          className="rounded-2xl px-4 py-3.5 shadow-xl ring-1 ring-white/10 backdrop-blur-lg"
          style={{ backgroundColor: `${phaseColor}F0` }}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20 text-2xl font-bold text-white">
              {getManeuverIcon(nextStep.maneuverType, nextStep.maneuverModifier)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-white leading-tight truncate">
                {nextStep.instruction}
              </p>
              {nextStep.name && (
                <p className="mt-0.5 truncate text-xs text-white/70 font-medium">
                  onto {nextStep.name}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold font-mono text-white">
                {formatDistanceShort(distanceToNextStep)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Arrival Banner ── */}
      {isArrived && (
        <div className="rounded-2xl bg-emerald-600 px-4 py-4 shadow-xl ring-1 ring-white/10 text-center">
          <p className="text-2xl mb-1">📍</p>
          <p className="text-base font-bold text-white">
            {arrivalZone === "at_vendor" ? "You've arrived at the shop!" : "You've arrived at the customer!"}
          </p>
          <p className="mt-1 text-xs text-white/80 font-medium truncate">
            {destinationLabel}
          </p>
        </div>
      )}

      {/* ── Near destination approach ── */}
      {isNear && !isArrived && (
        <div className="rounded-xl bg-amber-500/95 px-3 py-2 text-center shadow-lg mt-2">
          <p className="text-sm font-semibold text-white">
            📍 Almost there! {formatDistanceShort(distanceToDestM)} away
          </p>
        </div>
      )}

      {/* ── Route Summary Bar ── */}
      <div className="mt-2 rounded-2xl bg-slate-900/95 shadow-xl ring-1 ring-white/10 backdrop-blur-lg overflow-hidden">
        {/* Phase & Destination */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-2.5">
          <span className="text-base">{phaseEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{phaseLabel}</p>
            <p className="text-sm font-semibold text-white truncate">{destinationLabel}</p>
          </div>
          {externalNavUrl && (
            <a
              href={externalNavUrl}
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all"
              title="Open OpenStreetMap Navigation"
            >
              <Navigation className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* ETA / Distance / Speed / Controls */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-4">
            {/* ETA */}
            <div>
              <p className="font-mono text-xs text-slate-500">ETA</p>
              <p className="font-mono text-lg font-bold text-emerald-400">
                {isRerouting ? "..." : formatDurationShort(etaSeconds)}
              </p>
            </div>
            {/* Distance */}
            <div>
              <p className="font-mono text-xs text-slate-500">DIST</p>
              <p className="font-mono text-lg font-bold text-white">
                {isRerouting ? "..." : formatDistanceShort(distanceToDestM)}
              </p>
            </div>
            {/* Speed */}
            <div>
              <p className="font-mono text-xs text-slate-500">SPEED</p>
              <p className="font-mono text-sm font-bold text-slate-300">
                {speedKmh} km/h
              </p>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshRoute}
              disabled={isRerouting}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white active:scale-95 transition-all disabled:opacity-40"
              title="Refresh route"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRerouting ? "animate-spin" : ""}`} />
            </button>
            {!followMode && (
              <button
                type="button"
                onClick={onRecenter}
                className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all"
                title="Re-center on driver"
              >
                <Locate className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* GPS quality bar */}
        <div className="flex items-center justify-between border-t border-white/5 px-4 py-1.5 text-[10px] font-mono">
          <span className={`flex items-center gap-1 ${isStale ? "text-amber-400" : accuracy && accuracy > 30 ? "text-amber-400" : "text-emerald-400"}`}>
            <span className="relative flex h-1.5 w-1.5">
              {!isStale && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            {isStale ? "GPS stale" : accuracy ? `±${Math.round(accuracy)}m` : "GPS active"}
          </span>
          {isOffRoute && (
            <span className="text-red-400 font-semibold">⚠ OFF ROUTE</span>
          )}
        </div>
      </div>
    </div>
  );
}
