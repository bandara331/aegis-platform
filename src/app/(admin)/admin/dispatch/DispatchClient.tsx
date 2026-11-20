"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, EmptyState, PageHeader, Tag, Toast } from "@/components/ui";
import { addOsmTileLayer, loadLeaflet, type LeafletMap } from "@/lib/maps/leaflet";
import type { DispatchPlanDto, VehicleDto } from "@/lib/api/types";

const ROUTE_COLORS = ["#7C3AED", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

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

export function DispatchClient({ googleMapsApiKey }: { googleMapsApiKey?: string }) {
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [plan, setPlan] = useState<DispatchPlanDto | null>(null);
  const [planning, setPlanning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [secondApproverId, setSecondApproverId] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState("Van");
  const [capacity, setCapacity] = useState("6");
  const [lat, setLat] = useState("6.9271");
  const [lon, setLon] = useState("79.8612");
  const [driver, setDriver] = useState("");
  const [skills, setSkills] = useState("");
  const [savingVehicle, setSavingVehicle] = useState(false);

  const mapRef = useRef<HTMLDivElement | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    try {
      const res = await fetch("/api/ops/dispatch/vehicles", { cache: "no-store" });
      if (res.ok) {
        const list = (await res.json()) as VehicleDto[];
        setVehicles(Array.isArray(list) ? list : []);
      }
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const leafletMapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function renderMap() {
      if (!mapRef.current || !plan) return;
      const L = await loadLeaflet();
      if (cancelled || !L || !mapRef.current) return;

      leafletMapRef.current?.remove();
      const map = L.map(mapRef.current, { zoomControl: true }).setView([7.4, 80.5], 8);
      addOsmTileLayer(L, map);

      const allBounds: [number, number][] = [];
      plan.routes.forEach((r, idx) => {
        const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
        const path = decodePolyline(r.encodedPolyline).map((p) => [p.lat, p.lng] as [number, number]);
        if (path.length > 0) {
          L.polyline(path, { color, weight: 4, opacity: 0.9 }).addTo(map);
          allBounds.push(...path);
        }
        r.stops.forEach((s) => {
          allBounds.push([s.latitude, s.longitude]);
          const m = L.circleMarker([s.latitude, s.longitude], {
            radius: 7,
            color: "#0F172A",
            weight: 2,
            fillColor: color,
            fillOpacity: 0.95,
          }).addTo(map);
          m.bindPopup(`<b>${r.vehicleName}</b><br/>Stop #${s.sequence}: #${s.trackingNumber} (${s.etaMinutes}m)`);
        });
      });

      if (allBounds.length > 1) {
        map.fitBounds(allBounds, { padding: [24, 24] });
      }
      leafletMapRef.current = map;
    }

    void renderMap();
    return () => {
      cancelled = true;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, [plan]);

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    setSavingVehicle(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ops/dispatch/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          vehicleType,
          capacity: Number(capacity),
          currentLatitude: Number(lat),
          currentLongitude: Number(lon),
          assignedDriverName: driver || null,
          skills,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error || data.message || "Failed to register vehicle.", error: true });
      } else {
        setName("");
        setDriver("");
        setSkills("");
        setMsg({ text: "Vehicle registered in PostgreSQL." });
        await loadVehicles();
      }
    } finally {
      setSavingVehicle(false);
    }
  }

  async function handleGeneratePlan() {
    setPlanning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ops/dispatch/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error || data.message || "Failed to generate dispatch plan.", error: true });
      } else {
        setPlan(data as DispatchPlanDto);
      }
    } finally {
      setPlanning(false);
    }
  }

  async function handleApprovePlan() {
    if (!plan) return;
    setApproving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/ops/dispatch/plans/${plan.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secondApproverId: secondApproverId.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error || data.message || "Approval rejected.", error: true });
      } else {
        setPlan({ ...plan, status: "Approved" });
        setMsg({ text: "Dispatch plan approved! Assignments created, notifications queued, audit sealed." });
      }
    } finally {
      setApproving(false);
    }
  }

  async function handleDiscardPlan() {
    if (!plan) return;
    await fetch(`/api/ops/dispatch/plans/${plan.id}/discard`, { method: "POST" });
    setPlan(null);
    setMsg({ text: "Preview plan discarded. No assignments were created." });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="GOOGLE OR-TOOLS ROUTE OPTIMISER"
        eyebrowTone="ai"
        title="Dispatch Optimisation (Preview & Approval)"
        subtitle="OR-Tools computes capacity-constrained, priority-weighted routes. Plans are previews only — human approval creates assignments."
      />

      {msg && <Toast tone={msg.error ? "critical" : "success"}>{msg.text}</Toast>}

      {/* Register real vehicle */}
      <Card>
        <h3 style={{ margin: "0 0 12px" }}>Register Relief Vehicle</h3>
        <form onSubmit={handleAddVehicle} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", alignItems: "end" }}>
          <div>
            <label className="bento-label">Vehicle name</label>
            <input className="bento-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Colombo Van 01" />
          </div>
          <div>
            <label className="bento-label">Type</label>
            <select className="bento-select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {["Van", "Truck", "Boat", "Ambulance", "Motorcycle"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="bento-label">Capacity</label>
            <input type="number" min={1} className="bento-input mono" required value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div>
            <label className="bento-label">Latitude</label>
            <input type="number" step="any" className="bento-input mono" required value={lat} onChange={(e) => setLat(e.target.value)} />
          </div>
          <div>
            <label className="bento-label">Longitude</label>
            <input type="number" step="any" className="bento-input mono" required value={lon} onChange={(e) => setLon(e.target.value)} />
          </div>
          <div>
            <label className="bento-label">Driver</label>
            <input className="bento-input" value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Driver name" />
          </div>
          <div>
            <label className="bento-label">Skills</label>
            <input className="bento-input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="medical,water" />
          </div>
          <Button type="submit" disabled={savingVehicle}>{savingVehicle ? "Saving…" : "Add vehicle"}</Button>
        </form>
      </Card>

      {/* Fleet + Generate Preview */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Registered Fleet ({vehicles.length})</h3>
            <div className="muted" style={{ fontSize: 12.5 }}>Only vehicles stored in PostgreSQL are used by OR-Tools.</div>
          </div>
          <Button type="button" onClick={handleGeneratePlan} disabled={planning || vehicles.length === 0}>
            {planning ? "Optimising…" : "Generate Optimized Plan (Preview)"}
          </Button>
        </div>

        {loadingVehicles ? (
          <div className="muted">Loading vehicles…</div>
        ) : vehicles.length === 0 ? (
          <EmptyState
            title="No vehicles registered"
            description="Add at least one relief vehicle above to enable OR-Tools dispatch optimisation."
          />
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {vehicles.map((v) => (
              <div key={v.id} style={{ border: "1px solid var(--border-card)", borderRadius: 12, padding: "10px 14px", fontSize: 12.5 }}>
                <b>{v.name}</b> <Tag>{v.vehicleType}</Tag>
                <div className="muted">Cap: {v.capacity} · {v.availability} · {v.assignedDriverName || "No driver"}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Plan Preview */}
      {plan && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ borderColor: "rgba(124,58,237,0.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="tag tag-ai">OR-Tools Plan · {plan.status}</span>
                  <span className="tag tag-muted">{plan.routingSource}</span>
                  {plan.isEstimated && <span className="tag tag-sun">Estimated travel times</span>}
                </div>
                <p style={{ margin: "8px 0 4px", fontSize: 13.5 }}>{plan.explanation}</p>
                <div className="mono muted" style={{ fontSize: 12 }}>
                  Total Distance: {plan.totalDistanceKm} km · Optimised Duration: {plan.totalDurationMinutes} min ·
                  Nearest-Vehicle Baseline: {plan.baselineDurationMinutes} min ·{" "}
                  <b style={{ color: "var(--violet)" }}>Saved: {plan.minutesSaved} min</b>
                </div>
              </div>

              {plan.status === "Preview" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {plan.requiresSecondApprover && (
                    <input
                      className="bento-input"
                      style={{ width: 190 }}
                      placeholder="Second approver ID (Critical)"
                      value={secondApproverId}
                      onChange={(e) => setSecondApproverId(e.target.value)}
                    />
                  )}
                  <Button type="button" onClick={handleApprovePlan} disabled={approving}>
                    {approving ? "Approving…" : "Approve & Dispatch"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleGeneratePlan} disabled={planning}>
                    Adjust / Re-run
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleDiscardPlan}>
                    Discard
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div ref={mapRef} style={{ width: "100%", height: 360, borderRadius: 12, background: "#E2E8F0", zIndex: 1 }} />
          </Card>

          <div className="bento-grid cols-2">
            {plan.routes.map((r, idx) => {
              const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
              return (
                <Card key={r.vehicleId}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 999, background: color, display: "inline-block" }} />
                      <b>{r.vehicleName}</b>
                      <span className="tag tag-muted">{r.vehicleType}</span>
                    </div>
                    <span className="mono muted" style={{ fontSize: 12 }}>
                      Load {r.totalLoad}/{r.capacity} · {r.totalDistanceKm} km · {r.totalDurationMinutes} min
                    </span>
                  </div>
                  {r.stops.map((s) => (
                    <div key={s.requestId} style={{ padding: "8px 0", borderTop: "1px solid var(--border-card)", fontSize: 12.5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <b>#{s.sequence} · {s.trackingNumber} ({s.category})</b>
                        <span className="tag tag-muted">{s.priority} · ETA {s.etaMinutes} min</span>
                      </div>
                      <div className="muted">{s.area} · {s.peopleCount} people · +{s.distanceFromPrevKm} km</div>
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>

          {plan.unserved.length > 0 && (
            <Card>
              <h3 style={{ margin: "0 0 8px" }}>Unserved Stops ({plan.unserved.length})</h3>
              {plan.unserved.map((u) => (
                <div key={u.requestId} style={{ padding: "8px 0", borderTop: "1px solid var(--border-card)", fontSize: 12.5 }}>
                  <b>{u.trackingNumber}</b> <Tag tone="warning">{u.priority}</Tag> · {u.peopleCount} people
                  <div className="muted">{u.reason}</div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
