"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, Tag, Toast } from "@/components/ui";

interface CampaignRow {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  isActive?: boolean;
}

export default function PublicDonationsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const [campaignId, setCampaignId] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [amount, setAmount] = useState("5000");
  const [submitting, setSubmitting] = useState(false);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/campaigns", { cache: "no-store" });
      if (!res.ok) {
        setError(`Failed to load campaigns (HTTP ${res.status}).`);
        return;
      }
      const data = (await res.json()) as CampaignRow[];
      const list = Array.isArray(data) ? data : [];
      setCampaigns(list);
      if (list.length > 0 && !campaignId) setCampaignId(list[0].id);
      setError(null);
    } catch {
      setError("Unable to reach donations service.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignId) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ops/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          donorName: donorName.trim(),
          donorEmail: donorEmail.trim(),
          amount: Number(amount),
          currency: "LKR",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error || "Could not record pledge.", error: true });
      } else {
        setMsg({
          text: data.flagged
            ? `Pledge of LKR ${Number(amount).toLocaleString()} recorded and flagged for coordinator review.`
            : `Thank you! Your pledge of LKR ${Number(amount).toLocaleString()} has been recorded.`,
        });
        setDonorName("");
        setDonorEmail("");
        setAmount("5000");
        await loadCampaigns();
      }
    } catch {
      setMsg({ text: "Network error while submitting pledge.", error: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 18 }}>
      <PageHeader
        eyebrow="RELIEF CAMPAIGNS & PLEDGES"
        eyebrowTone="success"
        title="Donations & Matching Campaigns"
        subtitle="Support active Sri Lankan relief drives. All pledges are recorded directly in the coordinator ledger."
      />

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <Card><div className="muted">Loading active campaigns…</div></Card>
      ) : campaigns.length === 0 ? (
        <EmptyState
          title="No active relief campaigns"
          description="Coordinators have not opened any relief fundraising campaigns yet."
        />
      ) : (
        <>
          <div className="bento-grid cols-2">
            {campaigns.map((c) => {
              const pct = c.targetAmount > 0 ? Math.min(100, Math.round((c.currentAmount / c.targetAmount) * 100)) : 0;
              const selected = campaignId === c.id;
              return (
                <Card
                  key={c.id}
                  style={{
                    border: selected ? "2px solid var(--teal)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <b style={{ fontSize: 16 }}>{c.title}</b>
                    <Tag tone="success">{pct}% funded</Tag>
                  </div>
                  <p className="muted" style={{ fontSize: 13, margin: "6px 0 12px" }}>
                    {c.description}
                  </p>
                  <div style={{ height: 8, width: "100%", borderRadius: 999, background: "rgba(15,23,42,0.08)", overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: 8, width: `${pct}%`, background: "var(--teal)", borderRadius: 999 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontSize: 12.5 }}>
                      <b>LKR {Number(c.currentAmount).toLocaleString()}</b> / {Number(c.targetAmount).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      className={`btn btn-sm ${selected ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setCampaignId(c.id)}
                    >
                      {selected ? "Selected" : "Select campaign"}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>Record a relief pledge</h2>
            <form onSubmit={handleDonate} style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="bento-label" htmlFor="don-camp">Campaign</label>
                <select
                  id="don-camp"
                  className="bento-select"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  required
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="auth-two-col">
                <div>
                  <label className="bento-label" htmlFor="don-name">Your name / organisation</label>
                  <input
                    id="don-name"
                    className="bento-input"
                    required
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="e.g. Kasun Perera"
                  />
                </div>
                <div>
                  <label className="bento-label" htmlFor="don-email">Email</label>
                  <input
                    id="don-email"
                    type="email"
                    className="bento-input"
                    required
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                    placeholder="you@example.lk"
                  />
                </div>
              </div>
              <div>
                <label className="bento-label" htmlFor="don-amt">Pledge amount (LKR)</label>
                <input
                  id="don-amt"
                  type="number"
                  min={1}
                  className="bento-input mono"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {msg && <Toast tone={msg.error ? "critical" : "success"}>{msg.text}</Toast>}
              <div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit relief pledge"}
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
