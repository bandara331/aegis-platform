"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, Tag, Toast } from "@/components/ui";

interface VolunteerRow {
  id: string;
  fullName: string;
  phoneNumber: string;
  skills: string;
  availability: string;
  district: string;
  isVerified: boolean;
  maskedNic?: string | null;
  latitude: number;
  longitude: number;
}

interface MatchResult {
  volunteerId: string;
  fullName: string;
  skills: string;
  availability: string;
  distanceKm: number;
  matchScore: number;
  explanation: string;
}

interface RequestOption {
  id: string;
  trackingNumber: string;
  category: string;
  area: string;
}

export default function AdminVolunteersPage() {
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);
  const [requests, setRequests] = useState<RequestOption[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const [matchRequestId, setMatchRequestId] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("FirstAid, Sinhala");
  const [matching, setMatching] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [vRes, rRes] = await Promise.all([
        fetch("/api/ops/volunteers", { cache: "no-store" }),
        fetch("/api/requests", { cache: "no-store" }),
      ]);
      if (!vRes.ok) {
        setError(`Failed to load volunteers (HTTP ${vRes.status}).`);
        return;
      }
      const vData = (await vRes.json()) as VolunteerRow[];
      setVolunteers(Array.isArray(vData) ? vData : []);
      if (rRes.ok) {
        const rData = (await rRes.json()) as RequestOption[];
        const arr = Array.isArray(rData) ? rData : [];
        setRequests(arr);
        if (arr[0] && !matchRequestId) setMatchRequestId(arr[0].id);
      }
      setError(null);
    } catch {
      setError("Unable to reach volunteer registry.");
    } finally {
      setLoading(false);
    }
  }, [matchRequestId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleVerify(id: string) {
    setMsg(null);
    const res = await fetch(`/api/ops/volunteers/${id}/verify`, { method: "POST" });
    if (!res.ok) setMsg({ text: "Verification failed.", error: true });
    else {
      setMsg({ text: "Volunteer verified and enabled for field assignments." });
      await loadAll();
    }
  }

  async function handleMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!matchRequestId) return;
    setMatching(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ops/volunteers/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: matchRequestId, requiredSkills }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ text: data.error || "Matching failed.", error: true });
      else setMatches(Array.isArray(data) ? data : []);
    } finally {
      setMatching(false);
    }
  }

  async function handleAssign(volunteerId: string) {
    if (!matchRequestId) return;
    setMsg(null);
    const res = await fetch("/api/ops/volunteers/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerId, requestId: matchRequestId }),
    });
    if (!res.ok) setMsg({ text: "Assignment failed.", error: true });
    else setMsg({ text: "Volunteer assigned and sealed in the audit log." });
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow="VOLUNTEER COORDINATION"
        eyebrowTone="accent"
        title="Volunteer Registry & AI Skill Matching"
        subtitle="Verify public volunteer registrations (with encrypted/masked optional NIC) and run explainable AI skill + distance matching."
      />

      {msg && <Toast tone={msg.error ? "critical" : "success"}>{msg.text}</Toast>}

      <Card aiHighlight>
        <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700 }}>AI-assisted volunteer matching</h2>
        <form onSubmit={handleMatch} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="bento-label">Target assistance request</label>
            <select className="bento-select" value={matchRequestId} onChange={(e) => setMatchRequestId(e.target.value)}>
              {requests.length === 0 ? (
                <option value="">No open requests</option>
              ) : (
                requests.map((r) => (
                  <option key={r.id} value={r.id}>#{r.trackingNumber} · {r.category} ({r.area})</option>
                ))
              )}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="bento-label">Required skills (comma-separated)</label>
            <input className="bento-input" value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} />
          </div>
          <Button type="submit" disabled={matching || !matchRequestId}>
            {matching ? "Matching…" : "Find best matches"}
          </Button>
        </form>

        {matches.length > 0 && (
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {matches.map((m) => (
              <div key={m.volunteerId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 14, background: "var(--violet-tint)" }}>
                <div style={{ fontSize: 13 }}>
                  <b>{m.fullName}</b> · <Tag tone="ai">Match {m.matchScore}%</Tag>
                  <div className="muted" style={{ marginTop: 4 }}>{m.explanation}</div>
                </div>
                <Button type="button" onClick={() => handleAssign(m.volunteerId)}>Assign to case</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <Card><div className="muted">Loading volunteers…</div></Card>
      ) : volunteers.length === 0 ? (
        <EmptyState
          title="No volunteers registered"
          description="Public registrations submitted via /volunteer-register will appear here for staff verification."
        />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-card)", background: "var(--bg-subtle)" }}>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>VOLUNTEER</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>SKILLS &amp; AVAILABILITY</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>NIC (MASKED)</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>VERIFICATION</th>
                </tr>
              </thead>
              <tbody>
                {volunteers.map((v) => (
                  <tr key={v.id} style={{ borderBottom: "1px solid var(--border-card)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <b>{v.fullName}</b>
                      <div className="muted mono" style={{ fontSize: 12 }}>{v.phoneNumber} · {v.district || "Sri Lanka"}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div>{v.skills}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{v.availability}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }} className="mono">
                      {v.maskedNic || "Not provided"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {v.isVerified ? (
                        <Tag tone="success">Verified</Tag>
                      ) : (
                        <Button type="button" onClick={() => handleVerify(v.id)}>Verify volunteer</Button>
                      )}
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
