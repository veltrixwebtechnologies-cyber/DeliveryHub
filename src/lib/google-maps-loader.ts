/// <reference types="google.maps" />

declare global {
  interface Window {
    google?: typeof google;
    __localshorePartnerMapsInit?: () => void;
    gm_authFailure?: () => void;
  }
}

let mapsPromise: Promise<typeof google> | null = null;

async function ensureMapsLibrary(): Promise<typeof google> {
  const googleApi = window.google;
  if (!googleApi?.maps) {
    throw new Error("Google Maps loaded without initializing the Maps JavaScript API.");
  }

  // The modern loader can expose `google.maps` before the Maps library itself
  // has finished loading. Make the library explicit before callers construct
  // `google.maps.Map` (otherwise `maps` exists but `Map` is undefined).
  const maps = googleApi.maps as typeof google.maps & {
    importLibrary?: (name: string) => Promise<unknown>;
  };
  if (typeof maps.Map !== "function" && typeof maps.importLibrary === "function") {
    await maps.importLibrary("maps");
  }

  if (typeof maps.Map !== "function") {
    throw new Error(
      "Google Maps initialized, but the Maps library is unavailable. Check that Maps JavaScript API is enabled for this key."
    );
  }

  return googleApi;
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }
  if (mapsPromise) return mapsPromise;

  if (window.google?.maps) {
    mapsPromise = ensureMapsLibrary().catch((error: unknown) => {
      mapsPromise = null;
      throw error;
    });
    return mapsPromise;
  }

  const key = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] as string | undefined;
  if (!key)
    return Promise.reject(new Error("Google Maps key missing. Set VITE_GOOGLE_MAPS_API_KEY."));

  mapsPromise = new Promise((resolve, reject) => {
    const fail = (message: string) => {
      mapsPromise = null;
      delete window.__localshorePartnerMapsInit;
      reject(new Error(message));
    };
    window.gm_authFailure = () =>
      fail("Google Maps rejected this domain. Check the browser key website restrictions.");
    window.__localshorePartnerMapsInit = () => {
      void ensureMapsLibrary()
        .then(resolve)
        .catch((error: unknown) => {
          fail(error instanceof Error ? error.message : "Google Maps failed to initialize.");
        });
      delete window.__localshorePartnerMapsInit;
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      loading: "async",
      callback: "__localshorePartnerMapsInit",
      v: "weekly",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => fail("Google Maps could not load. Check your network and API key.");
    document.head.appendChild(script);
  });

  return mapsPromise;
}
