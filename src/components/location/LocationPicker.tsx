"use client";

import { useEffect, useState, type MouseEvent } from "react";

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

  function acquireGps() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus("Geolocation unavailable in this browser — select your district or tap map.");
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
        onChange({
          ...value,
          latitude: lat,
          longitude: lng,
          gpsAcquired: true,
        });
      },
      () => {
        setLocating(false);
        setGpsStatus("GPS permission declined — tap map or enter your area below.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // GPS by default on mount
  useEffect(() => {
    acquireGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMapClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
    const relY = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));

    // Map Sri Lanka bounding box (~5.9°N..9.8°N, 79.6°E..81.9°E)
    const lat = Number((9.8 - relY * (9.8 - 5.9)).toFixed(5));
    const lng = Number((79.6 + relX * (81.9 - 79.6)).toFixed(5));
    setGpsStatus("Pin placed on map");
    onChange({
      ...value,
      latitude: lat,
      longitude: lng,
      gpsAcquired: true,
    });
  }

  // Compute pin position inside map box from lat/lng
  const pinLeftPct = Math.max(
    10,
    Math.min(90, ((value.longitude - 79.6) / (81.9 - 79.6)) * 100)
  );
  const pinTopPct = Math.max(
    15,
    Math.min(85, ((9.8 - value.latitude) / (9.8 - 5.9)) * 100)
  );

  return (
    <div className="field">
      <label className="label">Your location (GPS by default)</label>
      <div className="loc-card">
        <div
          className="loc-map"
          onClick={handleMapClick}
          role="button"
          tabIndex={0}
          aria-label="Interactive location picker map — click to adjust pin"
          style={{ cursor: "crosshair" }}
        >
          <svg viewBox="0 0 320 92" preserveAspectRatio="none">
            <rect width="320" height="92" fill="#E6EEF6" />
            <path
              d="M0 60 Q 90 40 170 65 T 320 55 L320 92 L0 92 Z"
              fill="#B9DFEC"
              opacity=".7"
            />
            <g stroke="#FFFFFF" strokeWidth="2.5" fill="none">
              <path d="M0 30 L 320 48" />
              <path d="M110 0 L 130 92" />
              <path d="M230 0 L 210 92" />
            </g>
          </svg>
          <div
            className="loc-pin"
            style={{
              left: `${pinLeftPct}%`,
              top: `${pinTopPct}%`,
            }}
          />
        </div>
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
            {locating ? "Locating…" : "Use my location"}
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
