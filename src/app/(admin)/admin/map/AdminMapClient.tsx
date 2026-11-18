"use client";

import { useEffect, useRef, useState } from "react";
import { Card, EmptyState, Tag } from "@/components/ui";
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
  const mapElRef = useRef<HTMLDivElement | null>(null);

  const districts = risk?.districts ?? [];

  useEffect(() => {
    if (!googleMapsApiKey || !mapElRef.current) return;

    const initMap = () => {
      if (!window.google?.maps || !mapElRef.current) return;
      const map = new window.google.maps.Map(mapElRef.current, {
        center: { lat: 7.8731, lng: 80.7718 },
        zoom: 7,
        mapTypeControl: false,
      });

      districts.forEach((d) => {
        const color = RISK_COLORS[d.riskLevel] ?? "#64748B";
        if (window.google?.maps.Circle) {
          const circle = new window.google.maps.Circle({
            map,
            center: { lat: d.latitude, lng: d.longitude },
            radius: 18000,
            strokeColor: color,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.35,
            clickable: true,
          });
          circle.addListener("click", () => setSelected(d));
        }
      });

      shelters.forEach((s) => {
        new window.google!.maps.Marker({
          map,
          position: { lat: s.latitude, lng: s.longitude },
          title: `${s.name} (${s.occupancy}/${s.capacity})`,
        });
      });
      setMapReady(true);
    };

    if (window.google?.maps) {
      initMap();
      return;
    }

    const scriptId = "aegis-gmaps-js";
    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}`;
      s.async = true;
      s.onload = initMap;
      document.head.appendChild(s);
    }
  }, [googleMapsApiKey, districts, shelters]);

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
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleRefreshRisk()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh Risk Index"}
          </button>
        </div>

        {googleMapsApiKey ? (
          <div
            ref={mapElRef}
            style={{ width: "100%", height: 420, borderRadius: 14, background: "#E2E8F0" }}
            aria-label={mapReady ? "Google Map with District Risk Circles" : "Loading Google Map"}
          />
        ) : districts.length === 0 && shelters.length === 0 ? (
          <EmptyState
            title="0 geospatial pins or district risk records"
            description="Submit requests or alerts with district names to populate real Open-Meteo risk circles."
          />
        ) : (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
            {districts.map((d) => {
              const color = RISK_COLORS[d.riskLevel] ?? "#64748B";
              const isSel = selected?.district === d.district;
              return (
                <button
                  key={d.district}
                  type="button"
                  onClick={() => setSelected(d)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 12,
                    border: isSel ? `2px solid ${color}` : "1px solid var(--border-card)",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, background: color, display: "inline-block" }} />
                    <b style={{ fontSize: 13.5 }}>{d.district}</b>
                  </div>
                  <div className="mono" style={{ fontSize: 12, marginTop: 4, color }}>
                    {d.riskLevel} ({d.riskScore})
                  </div>
                  <div className="muted mono" style={{ fontSize: 11 }}>
                    {d.latitude.toFixed(2)}, {d.longitude.toFixed(2)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

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
