"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, Tag, Toast } from "@/components/ui";

interface CampaignRow {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  isActive: boolean;
}

interface DonationRow {
  id: string;
  campaignId: string;
  donorName: string;
  amount: number;
  currency: string;
  flagged: boolean;
  flagReason?: string | null;
  createdAt: string;
  reviewStatus?: string | null;
  reviewNotes?: string | null;
}

export default function AdminDonationsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Campaign form
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cTarget, setCTarget] = useState("500000");

  // Donation form (no payment gateway)
  const [dCamp, setDCamp] = useState("");
  const [dName, setDName] = useState("");
  const [dEmail, setDEmail] = useState("");
  const [dAmount, setDAmount] = useState("5000");

  const loadAll = useCallback(async () => {
    try {
      const [cRes, dRes] = await Promise.all([
        fetch("/api/ops/campaigns", { cache: "no-store" }),
        fetch(`/api/ops/donations${flaggedOnly ? "?flaggedOnly=true" : ""}`, { cache: "no-store" }),
      ]);
      if (!dRes.ok) {
        setError(`Failed to load donations (HTTP ${dRes.status}).`);
        return;
      }
      const cList = cRes.ok ? ((await cRes.json()) as CampaignRow[]) : [];
      const dList = (await dRes.json()) as DonationRow[];
      setCampaigns(Array.isArray(cList) ? cList : []);
      setDonations(Array.isArray(dList) ? dList : []);
      if (cList[0] && !dCamp) setDCamp(cList[0].id);
      setError(null);
    } catch {
      setError("Unable to reach donations service.");
    } finally {
      setLoading(false);
    }
  }, [flaggedOnly, dCamp]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/ops/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        crisisId: "00000000-0000-0000-0000-000000000000",
        title: cTitle.trim(),
        description: cDesc.trim(),
        targetAmount: Number(cTarget),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: data.error || "Failed to create campaign.", error: true });
    else {
      setMsg({ text: `Campaign "${data.title}" created.` });
      setCTitle("");
      setCDesc("");
      await loadAll();
    }
  }

  async function handleRecordDonation(e: React.FormEvent) {
    e.preventDefault();
    if (!dCamp) return;
    setMsg(null);
    const res = await fetch("/api/ops/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: dCamp,
        donorName: dName.trim(),
        donorEmail: dEmail.trim(),
        amount: Number(dAmount),
        currency: "LKR",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: data.error || "Failed to record donation.", error: true });
    else {
      setMsg({
        text: data.flagged
          ? `Recorded & FLAGGED for human review: ${data.flagReason}`
          : `Donation of LKR ${Number(data.amount).toLocaleString()} recorded.`,
        error: Boolean(data.flagged),
      });
      setDName("");
      setDEmail("");
      await loadAll();
    }
  }

  async function handleReview(id: string, approve: boolean) {
    setMsg(null);
    const res = await fetch(`/api/ops/donations/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve, notes: approve ? "Verified by Donor Officer" : "Rejected during anomaly review" }),
    });
    if (!res.ok) setMsg({ text: "Review action failed.", error: true });
    else {
      setMsg({ text: approve ? "Flagged donation approved and added to campaign total." : "Flagged donation rejected." });
      await loadAll();
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow="DONOR OVERSIGHT & ANOMALY DETECTION"
        eyebrowTone="accent"
        title="Campaigns & Donations"
        subtitle="Record direct relief pledges (no payment gateway) and review statistical high-value or rapid-repeat anomalies."
      />

      <div className="bento-grid cols-2">
        <Card>
          <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>Create relief campaign</h2>
          <form onSubmit={handleCreateCampaign} style={{ display: "grid", gap: 10 }}>
            <div>
              <label className="bento-label">Campaign title</label>
              <input className="bento-input" required value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="e.g. Kalutara Flood Medical Fund" />
            </div>
            <div>
              <label className="bento-label">Description</label>
              <input className="bento-input" required value={cDesc} onChange={(e) => setCDesc(e.target.value)} />
            </div>
            <div>
              <label className="bento-label">Target amount (LKR)</label>
              <input type="number" min={1} className="bento-input mono" required value={cTarget} onChange={(e) => setCTarget(e.target.value)} />
            </div>
            <Button type="submit">Create campaign</Button>
          </form>
        </Card>

        <Card>
          <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>Record real donation (manual ledger)</h2>
          <form onSubmit={handleRecordDonation} style={{ display: "grid", gap: 10 }}>
            <div>
              <label className="bento-label">Campaign</label>
              <select className="bento-select" value={dCamp} onChange={(e) => setDCamp(e.target.value)} required>
                {campaigns.length === 0 ? <option value="">Create a campaign first</option> : campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div className="auth-two-col">
              <div>
                <label className="bento-label">Donor name</label>
                <input className="bento-input" required value={dName} onChange={(e) => setDName(e.target.value)} />
              </div>
              <div>
                <label className="bento-label">Donor email</label>
                <input type="email" className="bento-input" required value={dEmail} onChange={(e) => setDEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="bento-label">Amount (LKR — &ge; 1,000,000 flags anomaly)</label>
              <input type="number" min={1} className="bento-input mono" required value={dAmount} onChange={(e) => setDAmount(e.target.value)} />
            </div>
            <Button type="submit" disabled={campaigns.length === 0}>Record donation</Button>
          </form>
        </Card>
      </div>

      {msg && <Toast tone={msg.error ? "warning" : "success"}>{msg.text}</Toast>}

      {campaigns.length > 0 && (
        <div className="bento-grid cols-2">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <b>{c.title}</b>
                  <div className="muted" style={{ fontSize: 13, margin: "4px 0 8px" }}>{c.description}</div>
                  <div className="mono" style={{ fontSize: 13 }}>
                    Raised: <b>LKR {Number(c.currentAmount).toLocaleString()}</b> / {Number(c.targetAmount).toLocaleString()}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  onClick={async () => {
                    if (!window.confirm(`Delete campaign "${c.title}"?`)) return;
                    const res = await fetch(`/api/ops/campaigns/${c.id}`, { method: "DELETE" });
                    if (res.ok) {
                      setMsg({ text: `Campaign "${c.title}" deleted.` });
                      await loadAll();
                    } else {
                      setMsg({ text: "Failed to delete campaign.", error: true });
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Donation ledger</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlaggedOnly((f) => !f)}>
          {flaggedOnly ? "Showing flagged only · Show all" : "Filter: Flagged anomalies only"}
        </button>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <Card><div className="muted">Loading donations…</div></Card>
      ) : donations.length === 0 ? (
        <EmptyState title="No donations recorded" description="Create a campaign and record a direct donation above." />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-card)", background: "var(--bg-subtle)" }}>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>DONOR</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>AMOUNT</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>ANOMALY / STATUS</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "right", fontSize: 11 }}>HUMAN REVIEW</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border-card)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <b>{d.donorName}</b>
                      <div className="muted mono" style={{ fontSize: 11.5 }}>{new Date(d.createdAt).toLocaleString()}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }} className="mono">
                      <b>{d.currency} {Number(d.amount).toLocaleString()}</b>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {d.flagged ? (
                        <div>
                          <Tag tone="critical">FLAGGED ANOMALY</Tag>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{d.flagReason}</div>
                        </div>
                      ) : (
                        <Tag tone="success">{d.reviewStatus || "Verified"}</Tag>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        {d.flagged && d.reviewStatus !== "Rejected" ? (
                          <>
                            <Button type="button" onClick={() => handleReview(d.id, true)}>Approve</Button>
                            <Button type="button" variant="secondary" onClick={() => handleReview(d.id, false)}>Reject</Button>
                          </>
                        ) : (
                          <span className="muted mono" style={{ fontSize: 12 }}>{d.reviewNotes || "—"}</span>
                        )}
                        <Button
                          type="button"
                          variant="danger"
                          onClick={async () => {
                            if (!window.confirm(`Delete donation from "${d.donorName}"?`)) return;
                            const res = await fetch(`/api/ops/donations/${d.id}`, { method: "DELETE" });
                            if (res.ok) {
                              setMsg({ text: "Donation deleted." });
                              await loadAll();
                            } else {
                              setMsg({ text: "Failed to delete donation.", error: true });
                            }
                          }}
                        >
                          Delete
                        </Button>
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
