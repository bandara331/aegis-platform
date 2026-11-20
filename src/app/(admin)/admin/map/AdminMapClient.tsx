"use client";

import { useEffect, useRef, useState } from "react";
import { Card, EmptyState, Tag } from "@/components/ui";
import { addOsmTileLayer, loadLeaflet, type LeafletMap } from "@/lib/maps/leaflet";
import type { DistrictRiskDto, DistrictRiskResponseDto, ShelterItem } from "@/lib/api/types";

interface Props {
  shelters: ShelterItem[];
  initialRisk: DistrictRiskResponseDto | null;
  googleMapsApiKey?: string;
}

const RISK_COLORS: Record<string, string> = {
  Low: "#10B981",
  Medium: "#F59E0B",
  High: "#F97316",
  Severe: "#DC2626",
};

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
        Circle?: new (opts: Record<string, unknown>) => { addListener: (ev: string, cb: () => void) => void };
        Polyline?: new (opts: Record<string, unknown>) => unknown;
        Marker: new (opts: Record<string, unknown>) => unknown;
      };
    };
  }
}

export function AdminMapClient({ shelters, initialRisk, googleMapsApiKey }: Props) {
  const [risk, setRisk] = useState<DistrictRiskResponseDto | null>(initialRisk);
  const [selected, setSelected] = useState<DistrictRiskDto | null>(initialRisk?.districts[0] ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [myGps, setMyGps] = useState<{ lat: number; lng: number } | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);

  const districts = risk?.districts ?? [];

  useEffect(() => {
    let cancelled = false;

    async function renderLiveMap() {
      if (!mapElRef.current) return;
      const L = await loadLeaflet();
      if (cancelled || !L || !mapElRef.current) return;

      leafletMapRef.current?.remove();
      const center: [number, number] = myGps ? [myGps.lat, myGps.lng] : [7.8731, 80.7718];
      const map = L.map(mapElRef.current, { zoomControl: true }).setView(center, myGps ? 11 : 7);
      addOsmTileLayer(L, map);

      districts.forEach((d) => {
        const color = RISK_COLORS[d.riskLevel] ?? "#64748B";
        const circle = L.circle([d.latitude, d.longitude], {
          radius: 16000,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.35,
        }).addTo(map);
        circle.bindPopup(`<b>${d.district}</b><br/>Risk: ${d.riskLevel} (${d.riskScore})`);
        circle.on("click", () => setSelected(d));
      });

      shelters.forEach((s) => {
        const marker = L.circleMarker([s.latitude, s.longitude], {
          radius: 7,
          color: "#0F172A",
          weight: 2,
          fillColor: "#14B8A6",
          fillOpacity: 0.95,
        }).addTo(map);
        marker.bindPopup(`<b>${s.name}</b><br/>Occupancy: ${s.occupancy}/${s.capacity}`);
      });

      if (myGps) {
        const me = L.circleMarker([myGps.lat, myGps.lng], {
          radius: 8,
          color: "#FFFFFF",
          weight: 3,
          fillColor: "#2563EB",
          fillOpacity: 1,
        }).addTo(map);
        me.bindPopup(`<b>Your GPS Location</b><br/>${myGps.lat.toFixed(4)}, ${myGps.lng.toFixed(4)}`);
      }

      leafletMapRef.current = map;
      setMapReady(true);
    }

    void renderLiveMap();
    return () => {
      cancelled = true;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, [districts, shelters, myGps]);

  function handleLocateMe() {
    if (!("geolocation" in navigator)) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setMyGps({ lat, lng });
      },
      () => setLocatingGps(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleRefreshRisk() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ops/ai/risk/refresh", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as DistrictRiskResponseDto;
        setRisk(data);
        setSelected(data.districts[0] ?? null);
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1.5fr) minmax(300px, 1fr)" }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div>
            <span className="tag tag-ai">District Risk Layer · {risk?.advisoryNotice ?? "advisory, not official"}</span>
            {risk?.lastUpdatedUtc && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Last updated: {new Date(risk.lastUpdatedUtc).toLocaleString()}
                {risk.anyStale && (
                  <span style={{ color: "#B45309", fontWeight: 700, marginLeft: 8 }}>
                    · Stale weather data warning
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleLocateMe}
              disabled={locatingGps}
            >
              {locatingGps ? "Locating…" : "My GPS"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void handleRefreshRisk()}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh Risk Index"}
            </button>
          </div>
        </div>

        <div
          ref={mapElRef}
          style={{ width: "100%", height: 430, borderRadius: 14, background: "#E2E8F0", zIndex: 1 }}
          aria-label={mapReady ? "Live OpenStreetMap with District Risk Circles and Shelters" : "Loading Live Map"}
        />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 12 }}>
          {Object.entries(RISK_COLORS).map(([lvl, col]) => (
            <span key={lvl} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: col, display: "inline-block" }} />
              {lvl}
            </span>
          ))}
        </div>
      </Card>

      {/* Details Drawer */}
      <Card>
        {!selected ? (
          <EmptyState
            title="No district selected"
            description="Click a district risk circle on the map to inspect its contributing factors."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{selected.district} District</h3>
              <Tag tone={selected.riskLevel === "Severe" || selected.riskLevel === "High" ? "critical" : selected.riskLevel === "Medium" ? "warning" : "success"}>
                {selected.riskLevel} · {selected.riskScore}/100
              </Tag>
            </div>
            <div className="tag tag-ai" style={{ alignSelf: "flex-start" }}>{selected.advisoryNotice}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Last updated: {new Date(selected.lastUpdatedUtc).toLocaleString()}
              {selected.isStale && (
                <div style={{ color: "#B45309", fontWeight: 700, marginTop: 4 }}>
                  Warning: Data is stale (older than configured threshold).
                </div>
              )}
            </div>
            <div style={{ borderTop: "1px solid var(--border-card)", paddingTop: 10 }}>
              <div className="mono muted" style={{ fontSize: 11, marginBottom: 8 }}>CONTRIBUTING FACTORS</div>
              {selected.factors.map((f) => (
                <div key={f.name} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-card)", fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b>{f.name}</b>
                    <span className="mono">+{f.weightContribution} pts</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Value: {f.value} · Source: {f.source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
