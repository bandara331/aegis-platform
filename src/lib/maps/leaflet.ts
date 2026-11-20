export interface LeafletMap {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  on: (event: string, cb: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  remove: () => void;
  fitBounds: (bounds: [number, number][], opts?: Record<string, unknown>) => void;
}

export interface LeafletLayer {
  addTo: (map: LeafletMap) => LeafletLayer;
  bindPopup: (html: string) => LeafletLayer;
  on: (event: string, cb: () => void) => LeafletLayer;
  setLatLng: (latlng: [number, number]) => LeafletLayer;
  remove: () => void;
}

export interface LeafletStatic {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  marker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletLayer;
  circle: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletLayer;
  circleMarker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletLayer;
  polyline: (latlngs: [number, number][], opts?: Record<string, unknown>) => LeafletLayer;
}

declare global {
  interface Window {
    L?: LeafletStatic;
  }
}

let loadingPromise: Promise<LeafletStatic | null> | null = null;

export function loadLeaflet(): Promise<LeafletStatic | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    if (!document.getElementById("aegis-leaflet-css")) {
      const link = document.createElement("link");
      link.id = "aegis-leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById("aegis-leaflet-js") as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L ?? null));
      return;
    }

    const script = document.createElement("script");
    script.id = "aegis-leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(window.L ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return loadingPromise;
}

export function addOsmTileLayer(L: LeafletStatic, map: LeafletMap) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);
}
