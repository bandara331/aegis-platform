"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, Tag, Toast } from "@/components/ui";

interface ResourceRow {
  id: string;
  itemName: string;
  category: string;
  quantityTotal: number;
  quantityAvailable: number;
  unit: string;
  depot: string;
  latitude: number;
  longitude: number;
}

interface RequestOption {
  id: string;
  trackingNumber: string;
  category: string;
  area: string;
  status: string;
}

interface ScenarioAllocation {
  requestId: string;
  trackingNumber: string;
  area: string;
  priority: string;
  requestedQuantity: number;
  strategyAllocated: number;
  etaMinutes: number;
  explanation: string;
}

interface ScenarioResult {
  strategy: string;
  resourceCategory: string;
  availableStock: number;
  totalRequested: number;
  unmetDemand: number;
  conflicts: string[];
  allocations: ScenarioAllocation[];
}

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [requests, setRequests] = useState<RequestOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // New stock form
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Water");
  const [quantityTotal, setQuantityTotal] = useState("100");
  const [unit, setUnit] = useState("units");
  const [depot, setDepot] = useState("");
  const [latitude, setLatitude] = useState("6.9271");
  const [longitude, setLongitude] = useState("79.8612");
  const [saving, setSaving] = useState(false);

  // Per-row dispatch
  const [allocQty, setAllocQty] = useState<Record<string, string>>({});
  const [allocReq, setAllocReq] = useState<Record<string, string>>({});

  // Scenario Lab
  const [scCategory, setScCategory] = useState("Water");
  const [scStrategy, setScStrategy] = useState("MaxUrgency");
  const [scStock, setScStock] = useState("50");
  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [runningSc, setRunningSc] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [resR, reqR] = await Promise.all([
        fetch("/api/ops/resources", { cache: "no-store" }),
        fetch("/api/requests", { cache: "no-store" }),
      ]);
      if (!resR.ok) {
        setError(`Failed to load resources (HTTP ${resR.status}).`);
        return;
      }
      const resData = (await resR.json()) as ResourceRow[];
      setResources(Array.isArray(resData) ? resData : []);
      if (reqR.ok) {
        const reqData = (await reqR.json()) as RequestOption[];
        setRequests(Array.isArray(reqData) ? reqData : []);
      }
      setError(null);
    } catch {
      setError("Unable to reach resources API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleCreateStock(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ops/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: itemName.trim(),
          category,
          quantityTotal: Number(quantityTotal),
          unit: unit.trim(),
          depot: depot.trim(),
          latitude: Number(latitude),
          longitude: Number(longitude),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ text: data.error || "Failed to add stock.", error: true });
      else {
        setMsg({ text: `Added ${data.quantityTotal} ${data.unit} of ${data.itemName} at ${data.depot}.` });
        setItemName("");
        setDepot("");
        await loadAll();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDispatch(resourceId: string) {
    const reqId = allocReq[resourceId] || requests[0]?.id;
    const qty = Number(allocQty[resourceId] || "1");
    if (!reqId) {
      setMsg({ text: "Select an open request to dispatch stock to.", error: true });
      return;
    }
    setMsg(null);
    const res = await fetch(`/api/ops/resources/${resourceId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: reqId, quantity: qty }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ text: data.error || `Dispatch conflict (HTTP ${res.status}).`, error: true });
    } else {
      const est = String(data.routeSource || "").toLowerCase().includes("fallback") ? " (estimated)" : "";
      setMsg({
        text: `Dispatched ${data.dispatchedQuantity} units · Remaining: ${data.remainingQuantity} · Distance: ${data.distanceKm} km · ETA: ${data.etaMinutes} min via ${data.routeSource}${est}`,
      });
      await loadAll();
    }
  }

  async function handleRunScenario(e: React.FormEvent) {
    e.preventDefault();
    setRunningSc(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ops/scenarios/shortage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceCategory: scCategory,
          strategy: scStrategy,
          availableStock: Number(scStock),
        }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ text: data.error || "Scenario failed.", error: true });
      else setScenario(data as ScenarioResult);
    } finally {
      setRunningSc(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow="LOGISTICS & SCENARIO LAB"
        eyebrowTone="accent"
        title="Relief Resources & Depots"
        subtitle="Enter real depot stock, dispatch to open requests with route ETA and 409 stock protection, and simulate scarcity strategies against real requests."
      />

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>Add relief stock</h2>
        <form onSubmit={handleCreateStock} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "end" }}>
          <div>
            <label className="bento-label">Item name</label>
            <input className="bento-input" required value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Drinking Water" />
          </div>
          <div>
            <label className="bento-label">Category</label>
            <select className="bento-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {["Water", "Food", "Medical", "Shelter", "Sanitation", "Protection", "Transport"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="bento-label">Quantity</label>
            <input type="number" min={1} className="bento-input mono" required value={quantityTotal} onChange={(e) => setQuantityTotal(e.target.value)} />
          </div>
          <div>
            <label className="bento-label">Unit</label>
            <input className="bento-input" required value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="liters / boxes" />
          </div>
          <div>
            <label className="bento-label">Depot location</label>
            <input className="bento-input" required value={depot} onChange={(e) => setDepot(e.target.value)} placeholder="e.g. Kalutara Depot" />
          </div>
          <div>
            <label className="bento-label">Latitude</label>
            <input type="number" step="any" className="bento-input mono" required value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          </div>
          <div>
            <label className="bento-label">Longitude</label>
            <input type="number" step="any" className="bento-input mono" required value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add stock"}</Button>
        </form>
      </Card>

      {msg && <Toast tone={msg.error ? "critical" : "success"}>{msg.text}</Toast>}

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <Card><div className="muted">Loading resources…</div></Card>
      ) : resources.length === 0 ? (
        <EmptyState title="No relief resources registered" description="Add real depot inventory above to enable dispatch and routing ETAs." />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-card)", background: "var(--bg-subtle)" }}>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>ITEM &amp; DEPOT</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>STOCK STATUS</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>DISPATCH TO REQUEST</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => {
                  const lowStock = r.quantityAvailable <= 10 || (r.quantityTotal > 0 && r.quantityAvailable / r.quantityTotal < 0.2);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border-card)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <b>{r.itemName}</b> <Tag>{r.category}</Tag>
                        <div className="muted" style={{ fontSize: 12 }}>{r.depot} ({r.latitude.toFixed(3)}, {r.longitude.toFixed(3)})</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Tag tone={r.quantityAvailable === 0 ? "critical" : lowStock ? "warning" : "success"}>
                          {r.quantityAvailable} / {r.quantityTotal} {r.unit} {lowStock ? "· LOW STOCK" : ""}
                        </Tag>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <select
                            className="bento-select"
                            style={{ minWidth: 180, padding: "6px 10px" }}
                            value={allocReq[r.id] ?? (requests[0]?.id || "")}
                            onChange={(e) => setAllocReq((p) => ({ ...p, [r.id]: e.target.value }))}
                          >
                            {requests.length === 0 ? (
                              <option value="">No open requests</option>
                            ) : (
                              requests.map((q) => (
                                <option key={q.id} value={q.id}>#{q.trackingNumber} · {q.category} ({q.area})</option>
                              ))
                            )}
                          </select>
                          <input
                            type="number"
                            min={1}
                            className="bento-input mono"
                            style={{ width: 70, padding: "6px 8px" }}
                            value={allocQty[r.id] ?? "1"}
                            onChange={(e) => setAllocQty((p) => ({ ...p, [r.id]: e.target.value }))}
                          />
                          <Button type="button" onClick={() => handleDispatch(r.id)} disabled={requests.length === 0}>
                            Dispatch
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Scenario Lab */}
      <Card>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Scenario Lab (Real Stock &amp; Open Requests)</h2>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>
          Read-only scarcity simulation against live PostgreSQL requests. Does not mutate stock or dispatch aid.
        </p>
        <form onSubmit={handleRunScenario} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <label className="bento-label">Category</label>
            <select className="bento-select" value={scCategory} onChange={(e) => setScCategory(e.target.value)}>
              {["Water", "Food", "Medical", "Shelter", "Sanitation", "Protection", "Transport"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="bento-label">Allocation strategy</label>
            <select className="bento-select" value={scStrategy} onChange={(e) => setScStrategy(e.target.value)}>
              <option value="MaxUrgency">MaxUrgency</option>
              <option value="FairShare">FairShare</option>
              <option value="FastestEta">FastestEta</option>
            </select>
          </div>
          <div>
            <label className="bento-label">Available stock</label>
            <input type="number" min={0} className="bento-input mono" style={{ width: 110 }} value={scStock} onChange={(e) => setScStock(e.target.value)} />
          </div>
          <Button type="submit" disabled={runningSc}>{runningSc ? "Running…" : "Run simulation"}</Button>
        </form>

        {scenario && (
          <div style={{ marginTop: 16 }}>
            {scenario.allocations.length === 0 ? (
              <EmptyState
                title={`No open ${scenario.resourceCategory} requests`}
                description="Scenario Lab only simulates against real open requests in PostgreSQL."
              />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="mono" style={{ fontSize: 13 }}>
                  Strategy: <b>{scenario.strategy}</b> · Requested: <b>{scenario.totalRequested}</b> · Unmet: <b>{scenario.unmetDemand}</b>
                </div>
                {scenario.allocations.map((a) => (
                  <div key={a.requestId} style={{ padding: "10px 14px", borderRadius: 12, background: "var(--surface-soft)", fontSize: 13 }}>
                    <b className="mono">#{a.trackingNumber}</b> ({a.priority}, {a.area}) — Allocated <b>{a.strategyAllocated}</b> / {a.requestedQuantity} · ETA {a.etaMinutes} min · {a.explanation}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
