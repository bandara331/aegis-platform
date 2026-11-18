"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  candidateId: string;
  trackingNumber: string;
  jaccardSimilarity: number;
  distanceMeters: number;
  hoursApart: number;
  isLikelyDuplicate: boolean;
  explanation: string;
}

export function DuplicatesPanel({ requestId, candidates, loadError }: { requestId: string; candidates: Candidate[]; loadError: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function act(action: "merge" | "keep-separate", c: Candidate) {
    setBusy(c.candidateId + action);
    setMsg(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/duplicates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          primaryRequestId: c.candidateId,
          candidateRequestId: c.candidateId,
          notes: action === "merge" ? `Linked as duplicate of ${c.trackingNumber}` : `Confirmed separate from ${c.trackingNumber}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ text: data.error || "Operation failed.", error: true });
      else {
        setMsg({ text: action === "merge" ? "Linked as duplicate." : "Marked as separate." });
        router.refresh();
      }
    } catch {
      setMsg({ text: "Unable to reach server.", error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sub-card">
      <div className="sub-head">
        <h3>Possible duplicates</h3>
        <span className="tag tag-muted">{candidates.length}</span>
      </div>
      {loadError && <div className="muted" style={{ fontSize: 12.5 }}>{loadError}</div>}
      {!loadError && candidates.length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>No nearby or similar requests found.</div>}
      {candidates.map((c) => (
        <div key={c.candidateId} style={{ padding: "10px 0", borderTop: "1px solid var(--border-card)", fontSize: 12.5 }}>
          <b className="mono">#{c.trackingNumber}</b>{" "}
          {c.isLikelyDuplicate && <span className="tag tag-sun">likely duplicate</span>}
          <div className="muted">{Math.round(c.distanceMeters)} m · {c.hoursApart.toFixed(1)} h apart · similarity {Math.round(c.jaccardSimilarity * 100)}%</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <a className="btn btn-ghost btn-sm" href={`/admin/requests/${c.trackingNumber}`}>Link / open</a>
            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act("keep-separate", c)}>Keep separate</button>
            <button className="btn btn-coral btn-sm" disabled={!!busy} onClick={() => act("merge", c)}>Merge</button>
          </div>
        </div>
      ))}
      {msg && <div className="mono" style={{ marginTop: 8, fontSize: 12, color: msg.error ? "#9F1E16" : "#086548" }}>{msg.text}</div>}
    </div>
  );
}
