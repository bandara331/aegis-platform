"use client";

import { useEffect, useRef, useState } from "react";
import { addOsmTileLayer, loadLeaflet, type LeafletMap } from "@/lib/maps/leaflet";

export interface LiveMapRequestPin {
  id: string;
  trackingNumber: string;
  category: string;
  area: string;
  priority: string;
  latitude: number;
  longitude: number;
}

export interface LiveMapShelterPin {
  id: string;
  name: string;
  occupancy: number;
  capacity: number;
  latitude: number;
  longitude: number;
}

interface Props {
  requests: LiveMapRequestPin[];
  shelters: LiveMapShelterPin[];
}

export function AdminOverviewLiveMap({ requests, shelters }: Props) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<LeafletMap | null>(null);
  const [locating, setLocating] = useState(false);
  const [myGps, setMyGps] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!mapElRef.current) return;
      const L = await loadLeaflet();
      if (cancelled || !L || !mapElRef.current) return;

      leafletRef.current?.remove();
      const map = L.map(mapElRef.current, { zoomControl: true }).setView([7.8731, 80.7718], 7);
      addOsmTileLayer(L, map);

      const bounds: [number, number][] = [];

      shelters.forEach((s) => {
        if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return;
        bounds.push([s.latitude, s.longitude]);
        L.circleMarker([s.latitude, s.longitude], {
          radius: 7,
          color: "#FFFFFF",
          weight: 2,
          fillColor: "#10B981",
          fillOpacity: 0.95,
        })
          .addTo(map)
          .bindPopup(`<b>Shelter: ${s.name}</b><br/>Occupancy: ${s.occupancy}/${s.capacity}`);
      });

      requests.forEach((r) => {
        if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return;
        bounds.push([r.latitude, r.longitude]);
        const p = r.priority.toLowerCase();
        const color = p === "critical" ? "#EF4444" : p === "high" ? "#F59E0B" : "#0D9488";
        L.circleMarker([r.latitude, r.longitude], {
          radius: 8,
          color: "#FFFFFF",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.95,
        })
          .addTo(map)
          .bindPopup(`<b>#${r.trackingNumber}</b> (${r.priority})<br/>${r.category} · ${r.area}`);
      });

      if (myGps) {
        bounds.push([myGps.lat, myGps.lng]);
        L.circleMarker([myGps.lat, myGps.lng], {
          radius: 8,
          color: "#FFFFFF",
          weight: 3,
          fillColor: "#2563EB",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(`<b>Your GPS</b><br/>${myGps.lat.toFixed(4)}, ${myGps.lng.toFixed(4)}`);
        map.setView([myGps.lat, myGps.lng], 11);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [24, 24] });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 11);
      }

      leafletRef.current = map;
    }

    void render();
    return () => {
      cancelled = true;
      leafletRef.current?.remove();
      leafletRef.current = null;
    };
  }, [requests, shelters, myGps]);

  function handleMyGps() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setMyGps({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={handleMyGps}
        disabled={locating}
        className="btn btn-ghost btn-sm"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 500,
          minHeight: 32,
          padding: "4px 10px",
          fontSize: 12,
        }}
      >
        {locating ? "Locating…" : "My GPS"}
      </button>
      <div
        ref={mapElRef}
        style={{ width: "100%", height: 260, borderRadius: 14, background: "#E2E8F0", zIndex: 1 }}
        aria-label="Live OpenStreetMap of active requests and shelters"
      />
    </div>
  );
}
