/**
 * Map Tile Provider Configuration for LocalShore Delivery Partner Hub
 *
 * Provides a clean, configurable map tile architecture for Leaflet maps.
 * Defaults to standard OpenStreetMap (OSM) tiles without any Carto dependency or API key requirements.
 */

export interface MapTileConfig {
  url: string;
  maxZoom: number;
  subdomains: string;
  attribution: string;
}

export function getMapTileConfig(): MapTileConfig {
  const customUrl = import.meta.env["VITE_MAP_TILE_URL"];

  if (customUrl) {
    return {
      url: customUrl,
      maxZoom: 19,
      subdomains: "abc",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    };
  }

  // Standard OpenStreetMap tiles (Free, Open-Source, No API Key Required)
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    subdomains: "abc",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  };
}
