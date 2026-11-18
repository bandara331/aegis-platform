"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, Tag, Toast } from "@/components/ui";

interface ShelterRow {
  id: string;
  name: string;
  district: string;
  capacity: number;
  occupancy: number;
  availableSpots: number;
  facilities: string;
  accessibilityTags: string;
  latitude: number;
  longitude: number;
  contactPerson: string;
  contactPhone: string;
}

interface CandidateFacility {
  name: string;
  district: string;
  facilityType: string;
  latitude: number;
  longitude: number;
}

const DISTRICTS = ["Colombo", "Gampaha", "Kalutara", "Kandy", "Galle", "Matara", "Ratnapura", "Kurunegala", "Jaffna", "Batticaloa"];

export default function AdminSheltersPage() {
  const [shelters, setShelters] = useState<ShelterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Import candidate facilities from OpenStreetMap Overpass
  const [importDistrict, setImportDistrict] = useState("Kalutara");
  const [candidates, setCandidates] = useState<CandidateFacility[]>([]);
  const [importing, setImporting] = useState(false);

  // Verify / Add Shelter form
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("Kalutara");
  const [capacity, setCapacity] = useState("100");
  const [occupancy, setOccupancy] = useState("0");
  const [facilities, setFacilities] = useState("Clean water, First aid, Sanitation");
  const [accessibilityTags, setAccessibilityTags] = useState("Wheelchair, GroundFloor");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [latitude, setLatitude] = useState("6.5854");
  const [longitude, setLongitude] = useState("79.9607");
  const [saving, setSaving] = useState(false);

  // Per-row allocation / occupancy inputs
  const [allocCounts, setAllocCounts] = useState<Record<string, string>>({});
  const [occInputs, setOccInputs] = useState<Record<string, string>>({});

  const loadShelters = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/shelters", { cache: "no-store" });
      if (!res.ok) {
        setError(`Unable to load shelters (HTTP ${res.status}).`);
        return;
      }
      const data = (await res.json()) as ShelterRow[];
      setShelters(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError("Unable to reach shelters service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShelters();
  }, [loadShelters]);

  async function handleImportCandidates() {
    setImporting(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/ops/shelters/candidates?district=${encodeURIComponent(importDistrict)}`);
      const data = await res.json();
      setCandidates(Array.isArray(data.items) ? data.items : []);
      if (data.error) setActionMsg({ text: data.error, error: true });
      else if ((data.items ?? []).length === 0) setActionMsg({ text: `No Overpass facilities returned for ${importDistrict}. You can add one manually.` });
    } catch {
      setActionMsg({ text: "Overpass import unavailable; enter facility details manually.", error: true });
    } finally {
      setImporting(false);
    }
  }

  function pickCandidate(c: CandidateFacility) {
    setName(c.name);
    setDistrict(c.district);
    setLatitude(String(c.latitude));
    setLongitude(String(c.longitude));
    setFacilities(`Verified ${c.facilityType}, Clean water, Sanitation`);
  }

  async function handleCreateShelter(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/ops/shelters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          district: district.trim(),
          capacity: Number(capacity),
          occupancy: Number(occupancy),
          facilities: facilities.trim(),
          accessibilityTags: accessibilityTags.trim(),
          latitude: Number(latitude),
          longitude: Number(longitude),
          contactPerson: contactPerson.trim(),
          contactPhone: contactPhone.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMsg({ text: data.error || "Failed to save shelter.", error: true });
      } else {
        setActionMsg({ text: `Shelter "${data.name}" verified and saved to PostgreSQL.` });
        setName("");
        setContactPerson("");
        setContactPhone("");
        await loadShelters();
      }
    } catch {
      setActionMsg({ text: "Network error while saving shelter.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleAllocate(shelterId: string) {
    const count = Number(allocCounts[shelterId] || "1");
    setActionMsg(null);
    const res = await fetch(`/api/ops/shelters/${shelterId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), personsCount: count }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionMsg({ text: data.error || `Allocation blocked (HTTP ${res.status}).`, error: true });
    } else {
      setActionMsg({ text: `Allocated ${count} person(s) to ${data.name}. Remaining spots: ${data.availableSpots}.` });
      await loadShelters();
    }
  }

  async function handleUpdateOccupancy(shelterId: string) {
    const occ = Number(occInputs[shelterId] ?? "0");
    setActionMsg(null);
    const res = await fetch(`/api/ops/shelters/${shelterId}/occupancy`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occupancy: occ, notes: "Updated by shelter staff" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionMsg({ text: data.error || `Occupancy update rejected (HTTP ${res.status}).`, error: true });
    } else {
      setActionMsg({ text: `Updated occupancy for ${data.name} to ${data.occupancy} / ${data.capacity}.` });
      await loadShelters();
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow="SHELTER CAPACITY & CONCURRENCY"
        eyebrowTone="accent"
        title="Emergency Shelters"
        subtitle="Verify imported OpenStreetMap facilities or register new shelters, update real occupancy, and allocate with PostgreSQL 409 over-capacity protection."
      />

      {/* Candidate Import + Verify Form */}
      <div className="bento-grid cols-2">
        <Card>
          <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>1. Import candidate facility (OpenStreetMap)</h2>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            Query real community halls, schools, and shelters in a Sri Lankan district, then click one to prefill verification.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select className="bento-select" value={importDistrict} onChange={(e) => setImportDistrict(e.target.value)}>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <Button type="button" onClick={handleImportCandidates} disabled={importing}>
              {importing ? "Fetching…" : "Fetch candidates"}
            </Button>
          </div>
          {candidates.length === 0 ? (
            <div className="muted" style={{ fontSize: 12.5 }}>
              No candidate facilities loaded yet. Fetch from Overpass or enter details on the right.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: 260, overflowY: "auto" }}>
              {candidates.map((c, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, background: "var(--surface-soft)" }}>
                  <div style={{ fontSize: 12.5 }}>
                    <b>{c.name}</b>
                    <div className="muted mono">{c.facilityType} · {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}</div>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => pickCandidate(c)}>Select</Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>2. Verify &amp; save shelter</h2>
          <form onSubmit={handleCreateShelter} style={{ display: "grid", gap: 10 }}>
            <div className="auth-two-col">
              <div>
                <label className="bento-label">Shelter name</label>
                <input className="bento-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kalutara Central College" />
              </div>
              <div>
                <label className="bento-label">District</label>
                <select className="bento-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
                  {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="auth-two-col">
              <div>
                <label className="bento-label">Real capacity (beds)</label>
                <input type="number" min={1} className="bento-input mono" required value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
              <div>
                <label className="bento-label">Current occupancy</label>
                <input type="number" min={0} className="bento-input mono" required value={occupancy} onChange={(e) => setOccupancy(e.target.value)} />
              </div>
            </div>
            <div className="auth-two-col">
              <div>
                <label className="bento-label">Contact person</label>
                <input className="bento-input" required value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Coordinator name" />
              </div>
              <div>
                <label className="bento-label">Contact phone</label>
                <input className="bento-input mono" required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="07XXXXXXXX" />
              </div>
            </div>
            <div>
              <label className="bento-label">Facilities &amp; accessibility</label>
              <input className="bento-input" required value={facilities} onChange={(e) => setFacilities(e.target.value)} />
            </div>
            <div className="auth-two-col">
              <div>
                <label className="bento-label">Latitude</label>
                <input type="number" step="any" className="bento-input mono" required value={latitude} onChange={(e) => setLatitude(e.target.value)} />
              </div>
              <div>
                <label className="bento-label">Longitude</label>
                <input type="number" step="any" className="bento-input mono" required value={longitude} onChange={(e) => setLongitude(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Verify & register shelter"}</Button>
          </form>
        </Card>
      </div>

      {actionMsg && (
        <Toast tone={actionMsg.error ? "critical" : "success"}>{actionMsg.text}</Toast>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <Card><div className="muted">Loading shelters…</div></Card>
      ) : shelters.length === 0 ? (
        <EmptyState
          title="No shelters registered"
          description="Import a candidate facility or register a verified shelter above."
        />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-card)", background: "var(--bg-subtle)" }}>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>SHELTER</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>OCCUPANCY</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>CONTACT</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>ALLOCATE PERSONS</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>SET OCCUPANCY</th>
                </tr>
              </thead>
              <tbody>
                {shelters.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--border-card)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <b>{s.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{s.district} · {s.facilities}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Tag tone={s.availableSpots === 0 ? "critical" : s.availableSpots < 10 ? "warning" : "success"}>
                        {s.occupancy} / {s.capacity} ({s.availableSpots} free)
                      </Tag>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12.5 }}>
                      <div>{s.contactPerson || "—"}</div>
                      <div className="mono muted">{s.contactPhone || "—"}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="number"
                          min={1}
                          className="bento-input mono"
                          style={{ width: 70, padding: "6px 8px" }}
                          value={allocCounts[s.id] ?? "1"}
                          onChange={(e) => setAllocCounts((p) => ({ ...p, [s.id]: e.target.value }))}
                        />
                        <Button type="button" onClick={() => handleAllocate(s.id)}>Allocate</Button>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="number"
                          min={0}
                          className="bento-input mono"
                          style={{ width: 70, padding: "6px 8px" }}
                          value={occInputs[s.id] ?? String(s.occupancy)}
                          onChange={(e) => setOccInputs((p) => ({ ...p, [s.id]: e.target.value }))}
                        />
                        <Button type="button" variant="secondary" onClick={() => handleUpdateOccupancy(s.id)}>Update</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
