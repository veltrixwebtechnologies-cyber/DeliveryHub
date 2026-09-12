type Listener = { position: PositionCallback; error: PositionErrorCallback };
const listeners = new Set<Listener>();
let watch: number | null = null;

/** All mounted delivery views share one precise browser location stream. */
export function watchGPS(position: PositionCallback, error: PositionErrorCallback): () => void {
  const listener = { position, error };
  listeners.add(listener);
  if (watch === null) {
    watch = navigator.geolocation.watchPosition(
      (value) => {
        for (const item of [...listeners]) item.position(value);
      },
      (reason) => {
        for (const item of [...listeners]) item.error(reason);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && watch !== null) {
      navigator.geolocation.clearWatch(watch);
      watch = null;
    }
  };
}
