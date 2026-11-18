"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, Tag, Toast } from "@/components/ui";

interface AlertRow {
  id: string;
  title: string;
  message: string;
  district: string;
  severity: string;
  language: string;
  issuedAtUtc: string;
  expiresAtUtc?: string | null;
  isExpired: boolean;
}

const DISTRICTS = ["All Districts", "Colombo", "Gampaha", "Kalutara", "Kandy", "Galle", "Matara", "Ratnapura", "Kurunegala", "Jaffna", "Batticaloa"];

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [district, setDistrict] = useState("All Districts");
  const [severity, setSeverity] = useState("Warning");
  const [language, setLanguage] = useState("en");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [saving, setSaving] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/alerts", { cache: "no-store" });
      if (!res.ok) {
        setError(`Failed to load alerts (HTTP ${res.status}).`);
        return;
      }
      const data = (await res.json()) as AlertRow[];
      setAlerts(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError("Unable to reach alerts API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ops/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          district,
          severity,
          language,
          expiresInHours: Number(expiresInHours) || 24,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ text: data.error || "Failed to publish alert.", error: true });
      else {
        setMsg({ text: `Official alert "${data.title}" published.` });
        setTitle("");
        setMessage("");
        await loadAlerts();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleExpire(id: string) {
    setMsg(null);
    const res = await fetch(`/api/ops/alerts/${id}/expire`, { method: "POST" });
    if (!res.ok) setMsg({ text: "Failed to expire alert.", error: true });
    else {
      setMsg({ text: "Alert expired and recorded in the audit log." });
      await loadAlerts();
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow="EMERGENCY BROADCASTS"
        eyebrowTone="warning"
        title="Official Alerts Management"
        subtitle="Create and expire multilingual crisis advisories for affected Sri Lankan districts. Active alerts appear immediately on /alerts."
      />

      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>Publish official alert</h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
          <div className="auth-two-col">
            <div>
              <label className="bento-label">Alert title</label>
              <input className="bento-input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kalutara River Flood Evacuation Notice" />
            </div>
            <div>
              <label className="bento-label">Target district</label>
              <select className="bento-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="bento-label">Advisory message</label>
            <textarea className="bento-textarea" rows={3} required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Clear safety instructions for citizens…" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "end" }}>
            <div>
              <label className="bento-label">Severity</label>
              <select className="bento-select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="Info">Info</option>
                <option value="Warning">Warning</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="bento-label">Language</label>
              <select className="bento-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English (en)</option>
                <option value="si">Sinhala (si)</option>
                <option value="ta">Tamil (ta)</option>
              </select>
            </div>
            <div>
              <label className="bento-label">Expires in (hours)</label>
              <input type="number" min={1} className="bento-input mono" value={expiresInHours} onChange={(e) => setExpiresInHours(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish official alert"}</Button>
          </div>
        </form>
      </Card>

      {msg && <Toast tone={msg.error ? "critical" : "success"}>{msg.text}</Toast>}

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <Card><div className="muted">Loading alerts…</div></Card>
      ) : alerts.length === 0 ? (
        <EmptyState title="No official alerts published" description="Publish an official emergency bulletin above when an advisory is active." />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {alerts.map((a) => {
            const expired = a.isExpired || (a.expiresAtUtc ? new Date(a.expiresAtUtc) <= new Date() : false);
            return (
              <Card key={a.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                      <Tag tone={a.severity === "Critical" ? "critical" : a.severity === "Warning" ? "warning" : "accent"}>{a.severity}</Tag>
                      <Tag>{a.district}</Tag>
                      <Tag>{a.language.toUpperCase()}</Tag>
                      <Tag tone={expired ? "default" : "success"}>{expired ? "Expired" : "Active"}</Tag>
                    </div>
                    <b style={{ fontSize: 16 }}>{a.title}</b>
                    <p style={{ margin: "6px 0 4px", fontSize: 13.5 }}>{a.message}</p>
                    <div className="mono muted" style={{ fontSize: 11.5 }}>
                      Issued {new Date(a.issuedAtUtc).toLocaleString()}
                      {a.expiresAtUtc ? ` · Expires ${new Date(a.expiresAtUtc).toLocaleString()}` : ""}
                    </div>
                  </div>
                  {!expired && (
                    <Button type="button" variant="secondary" onClick={() => handleExpire(a.id)}>
                      Expire alert
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
