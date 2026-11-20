"use client";

import { useEffect, useRef, useState } from "react";
import { addOsmTileLayer, loadLeaflet, type LeafletLayer, type LeafletMap } from "@/lib/maps/leaflet";

export interface LocationValue {
  area: string;
  latitude: number;
  longitude: number;
  gpsAcquired: boolean;
}

interface LocationPickerProps {
  districts: { provinceCode: string; name: string }[];
  value: LocationValue;
  onChange: (next: LocationValue) => void;
}

export function LocationPicker({ districts, value, onChange }: LocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>("Requesting GPS location…");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletLayer | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  onChangeRef.current = onChange;
  valueRef.current = value;

  function acquireGps() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus("Geolocation unavailable — tap the live map or select your district.");
      return;
    }

    setLocating(true);
    setGpsStatus("Acquiring GPS signal…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setGpsStatus(`GPS locked (±${Math.round(pos.coords.accuracy)}m)`);
        onChangeRef.current({
          ...valueRef.current,
          latitude: lat,
          longitude: lng,
          gpsAcquired: true,
        });
        if (mapRef.current && markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          mapRef.current.setView([lat, lng], 14);
        }
      },
      () => {
        setLocating(false);
        setGpsStatus("GPS permission declined — tap anywhere on the map to drop your pin.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Initialize live OpenStreetMap + acquire GPS on mount
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const L = await loadLeaflet();
      if (cancelled || !L || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView(
        [valueRef.current.latitude, valueRef.current.longitude],
        valueRef.current.gpsAcquired ? 14 : 8
      );
      addOsmTileLayer(L, map);

      const pin = L.circleMarker([valueRef.current.latitude, valueRef.current.longitude], {
        radius: 9,
        color: "#0F766E",
        weight: 3,
        fillColor: "#14B8A6",
        fillOpacity: 0.9,
      }).addTo(map);
      pin.bindPopup("Your incident pin");

      map.on("click", (e) => {
        const lat = Number(e.latlng.lat.toFixed(5));
        const lng = Number(e.latlng.lng.toFixed(5));
        pin.setLatLng([lat, lng]);
        setGpsStatus("Pin placed on live map");
        onChangeRef.current({
          ...valueRef.current,
          latitude: lat,
          longitude: lng,
          gpsAcquired: true,
        });
      });

      mapRef.current = map;
      markerRef.current = pin;
    }

    void init();
    acquireGps();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker synced if parent updates coordinates
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([value.latitude, value.longitude]);
    }
  }, [value.latitude, value.longitude]);

  return (
    <div className="field">
      <label className="label">Your location (live GPS map)</label>
      <div className="loc-card">
        <div
          ref={mapContainerRef}
          aria-label="Interactive OpenStreetMap location picker — click to place pin"
          style={{
            width: "100%",
            height: 220,
            borderRadius: 12,
            overflow: "hidden",
            background: "#E2E8F0",
            zIndex: 1,
          }}
        />
        <div className="loc-row">
          <div>
            <b style={{ display: "block", fontSize: "12.5px", color: "var(--ink)" }}>
              {value.latitude.toFixed(4)}° N, {value.longitude.toFixed(4)}° E
            </b>
            <span className="muted" style={{ fontSize: "11px" }}>
              {gpsStatus}
            </span>
          </div>
          <button
            type="button"
            onClick={acquireGps}
            style={{
              fontSize: "11.5px",
              fontWeight: 600,
              color: "var(--teal)",
              background: "var(--teal-tint)",
              padding: "6px 10px",
              borderRadius: "999px",
              border: 0,
              cursor: "pointer",
            }}
          >
            {locating ? "Locating…" : "Use my GPS"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "6px" }}>
        <div>
          <label className="label" htmlFor="loc-district" style={{ fontSize: "11px" }}>
            District (from database)
          </label>
          <select
            id="loc-district"
            className="input"
            value={districts.some((d) => d.name === value.area) ? value.area : ""}
            onChange={(e) => {
              if (e.target.value) {
                onChange({ ...value, area: e.target.value });
              }
            }}
            style={{ height: "42px", fontSize: "13px" }}
          >
            <option value="">Select district…</option>
            {districts.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} ({d.provinceCode})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="loc-area-text" style={{ fontSize: "11px" }}>
            Town / Landmark / Area
          </label>
          <input
            id="loc-area-text"
            type="text"
            className="input"
            placeholder="e.g. Kalutara North"
            value={value.area}
            onChange={(e) => onChange({ ...value, area: e.target.value })}
            required
            style={{ height: "42px", fontSize: "13px" }}
          />
        </div>
      </div>
    </div>
  );
}
