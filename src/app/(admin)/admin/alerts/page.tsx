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

interface WeatherRule {
  id: string;
  name: string;
  mode: "AutoSend" | "DraftForApproval" | "Off";
  triggerLevels: string;
  rainfall24hHighMm: number;
  rainfall24hSevereMm: number;
  rainfall72hHighMm: number;
  rainfall72hSevereMm: number;
  riverDischargeHighM3s: number;
  riverDischargeSevereM3s: number;
  cooldownHours: number;
  hysteresisMargin: number;
  sendRiskReducedNotice: boolean;
  dailyAlertCapPerDistrict: number;
  maxDataAgeMinutes: number;
  lastEvaluatedAtUtc?: string | null;
  lastEvaluationStatus?: string | null;
}

interface AutomatedAlertRow {
  id: string;
  district: string;
  previousLevel: string;
  triggeredLevel: string;
  alertKind: string;
  status: string;
  dataSource: string;
  dataTimestampUtc: string;
  modelUsed: string;
  promptVersion: string;
  messageEn: string;
  messageSi: string;
  messageTa: string;
  recipientCount: number;
  isFalseAlarm: boolean;
  retractionReason?: string | null;
  createdAt: string;
}

interface AutomationView {
  rule: WeatherRule;
  approvalQueue: AutomatedAlertRow[];
  history: AutomatedAlertRow[];
  analytics: {
    totalAlerts: number;
    sentCount: number;
    draftCount: number;
    retractedCount: number;
    falseAlarmCount: number;
    falseAlarmRate: number;
  };
}

interface DryRunPreview {
  district: string;
  evaluatedLevel: string;
  eligibleRecipientCount: number;
  factsJson: string;
  modelUsed: string;
  promptVersion: string;
  messageEn: string;
  messageSi: string;
  messageTa: string;
}

const DISTRICTS = ["All Districts", "Colombo", "Gampaha", "Kalutara", "Kandy", "Galle", "Matara", "Ratnapura", "Kurunegala", "Jaffna", "Batticaloa"];

export default function AdminAlertsPage() {
  const [tab, setTab] = useState<"official" | "automation">("official");
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Official alert form
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [district, setDistrict] = useState("All Districts");
  const [severity, setSeverity] = useState("Warning");
  const [language, setLanguage] = useState("en");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [saving, setSaving] = useState(false);

  // Automation state
  const [autoView, setAutoView] = useState<AutomationView | null>(null);
  const [pendingMode, setPendingMode] = useState<"AutoSend" | "DraftForApproval" | "Off" | null>(null);
  const [modeReason, setModeReason] = useState("");
  const [ruleReason, setRuleReason] = useState("");
  const [previewDistrict, setPreviewDistrict] = useState("Colombo");
  const [dryRun, setDryRun] = useState<DryRunPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ text: string; error?: boolean } | null>(null);
  const [retractTargetId, setRetractTargetId] = useState<string | null>(null);
  const [retractReason, setRetractReason] = useState("");

  const loadAlerts = useCallback(async () => {
    try {
      const [officialRes, autoRes] = await Promise.all([
        fetch("/api/ops/alerts", { cache: "no-store" }),
        fetch("/api/ops/alerts/automation", { cache: "no-store" }),
      ]);
      if (officialRes.ok) {
        const data = await officialRes.json();
        setAlerts(Array.isArray(data) ? data : []);
      } else {
        setError(`Failed to load alerts (HTTP ${officialRes.status}).`);
      }
      if (autoRes.ok) {
        const autoData = (await autoRes.json()) as AutomationView;
        setAutoView(autoData);
      }
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

  async function handleDeleteOfficial(id: string) {
    if (!window.confirm("Delete this official alert?")) return;
    setMsg(null);
    const res = await fetch(`/api/ops/alerts/${id}`, { method: "DELETE" });
    if (!res.ok) setMsg({ text: "Failed to delete alert.", error: true });
    else {
      setMsg({ text: "Official alert deleted." });
      await loadAlerts();
    }
  }

  async function handleDeleteAutomated(id: string) {
    if (!window.confirm("Delete this automated alert?")) return;
    setMsg(null);
    const res = await fetch(`/api/ops/alerts/automation/${id}`, { method: "DELETE" });
    if (!res.ok) setMsg({ text: "Failed to delete automated alert.", error: true });
    else {
      setMsg({ text: "Automated alert deleted." });
      await loadAlerts();
    }
  }

  async function handleConfirmModeSwitch() {
    if (!pendingMode || modeReason.trim().length < 5) return;
    setMsg(null);
    const res = await fetch("/api/ops/alerts/automation/rule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: pendingMode, reason: modeReason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: data.error || "Failed to switch mode.", error: true });
    else {
      setMsg({ text: `Automation mode switched to ${pendingMode}.` });
      setPendingMode(null);
      setModeReason("");
      await loadAlerts();
    }
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!autoView?.rule || ruleReason.trim().length < 5) {
      setMsg({ text: "Audit reason (at least 5 characters) is required.", error: true });
      return;
    }
    const r = autoView.rule;
    const res = await fetch("/api/ops/alerts/automation/rule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rainfall24hHighMm: r.rainfall24hHighMm,
        rainfall24hSevereMm: r.rainfall24hSevereMm,
        rainfall72hHighMm: r.rainfall72hHighMm,
        rainfall72hSevereMm: r.rainfall72hSevereMm,
        riverDischargeHighM3s: r.riverDischargeHighM3s,
        riverDischargeSevereM3s: r.riverDischargeSevereM3s,
        cooldownHours: r.cooldownHours,
        hysteresisMargin: r.hysteresisMargin,
        dailyAlertCapPerDistrict: r.dailyAlertCapPerDistrict,
        maxDataAgeMinutes: r.maxDataAgeMinutes,
        sendRiskReducedNotice: r.sendRiskReducedNotice,
        reason: ruleReason.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: data.error || "Failed to save thresholds.", error: true });
    else {
      setMsg({ text: "Automation thresholds saved and audited." });
      setRuleReason("");
      await loadAlerts();
    }
  }

  async function handleEvaluateNow() {
    setMsg(null);
    const res = await fetch("/api/ops/alerts/automation/evaluate", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: data.error || "Live weather evaluation failed.", error: true });
    else {
      setMsg({ text: `Live Open-Meteo check complete: ${data.created ?? 0} new alert(s) detected.` });
      await loadAlerts();
    }
  }

  async function handleDryRun() {
    setMsg(null);
    setTestResult(null);
    setPreviewing(true);
    try {
      const res = await fetch(`/api/ops/alerts/automation/dry-run?district=${encodeURIComponent(previewDistrict)}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setTestResult({ text: data.error || "Dry-run preview failed.", error: true });
      else setDryRun(data as DryRunPreview);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleTestToMe() {
    setMsg(null);
    setTestResult(null);
    setTesting(true);
    try {
      const res = await fetch(`/api/ops/alerts/automation/test-me?district=${encodeURIComponent(previewDistrict)}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setTestResult({ text: data.error || "Failed to send test email.", error: true });
      else setTestResult({ text: `Test advisory email sent to your account for ${previewDistrict}.` });
    } catch {
      setTestResult({ text: "Network error while sending test email.", error: true });
    } finally {
      setTesting(false);
    }
  }

  async function handleApprove(id: string) {
    const res = await fetch(`/api/ops/alerts/automation/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Approved by staff reviewer" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: data.error || "Failed to approve alert.", error: true });
    else {
      setMsg({ text: `Automated alert approved and queued for ${data.recipientCount ?? 0} recipient(s).` });
      await loadAlerts();
    }
  }

  async function handleConfirmRetract() {
    if (!retractTargetId || retractReason.trim().length < 5) return;
    const res = await fetch(`/api/ops/alerts/automation/${retractTargetId}/retract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: retractReason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ text: data.error || "Failed to retract alert.", error: true });
    else {
      setMsg({ text: "Alert retracted and correction email queued." });
      setRetractTargetId(null);
      setRetractReason("");
      await loadAlerts();
    }
  }

  async function handleMarkFalseAlarm(id: string) {
    const res = await fetch(`/api/ops/alerts/automation/${id}/false-alarm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Marked not accurate by staff" }),
    });
    if (!res.ok) setMsg({ text: "Failed to mark false alarm.", error: true });
    else {
      setMsg({ text: "Marked as not accurate (false alarm) and recorded in analytics." });
      await loadAlerts();
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow="EMERGENCY BROADCASTS & WEATHER AUTOMATION"
        eyebrowTone="warning"
        title="Alerts Management"
        subtitle="Manage official coordinator broadcasts and automated email weather advisories."
      />

      <div className="pills">
        <button type="button" className={`pill ${tab === "official" ? "on" : ""}`} onClick={() => setTab("official")}>
          Official Alerts ({alerts.length})
        </button>
        <button type="button" className={`pill ${tab === "automation" ? "on" : ""}`} onClick={() => setTab("automation")}>
          Automation ({autoView?.rule.mode ?? "—"})
        </button>
      </div>

      {msg && <Toast tone={msg.error ? "critical" : "success"}>{msg.text}</Toast>}

      {tab === "official" ? (
        <>
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
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {!expired && (
                          <Button type="button" variant="secondary" onClick={() => handleExpire(a.id)}>
                            Expire alert
                          </Button>
                        )}
                        <Button type="button" variant="danger" onClick={() => handleDeleteOfficial(a.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Analytics + Mode */}
          <div className="bento-grid cols-2">
            <Card aiHighlight>
              <Tag tone="ai">AUTOMATION MODE</Tag>
              <h2 style={{ margin: "8px 0 6px", fontSize: 17, fontWeight: 700 }}>
                Current mode: {autoView?.rule.mode ?? "DraftForApproval"}
              </h2>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
                Last evaluated: {autoView?.rule.lastEvaluatedAtUtc ? new Date(autoView.rule.lastEvaluatedAtUtc).toLocaleString() : "Not yet"}
                {autoView?.rule.lastEvaluationStatus ? ` · ${autoView.rule.lastEvaluationStatus}` : ""}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["AutoSend", "DraftForApproval", "Off"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn btn-sm ${autoView?.rule.mode === m ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => { if (autoView?.rule.mode !== m) setPendingMode(m); }}
                  >
                    {m}
                  </button>
                ))}
                <button type="button" className="btn btn-sm btn-ghost" onClick={handleEvaluateNow}>
                  Run Live Weather Check Now
                </button>
              </div>
            </Card>

            <Card>
              <Tag tone="warning">FALSE-ALARM ANALYTICS</Tag>
              <div className="bento-grid cols-2" style={{ marginTop: 12 }}>
                <div className="kv"><span>Total detected</span><b className="mono">{autoView?.analytics.totalAlerts ?? 0}</b></div>
                <div className="kv"><span>Sent / Draft</span><b className="mono">{autoView?.analytics.sentCount ?? 0} / {autoView?.analytics.draftCount ?? 0}</b></div>
                <div className="kv"><span>Retracted</span><b className="mono">{autoView?.analytics.retractedCount ?? 0}</b></div>
                <div className="kv"><span>False alarms</span><b className="mono">{autoView?.analytics.falseAlarmCount ?? 0} ({Math.round((autoView?.analytics.falseAlarmRate ?? 0) * 100)}%)</b></div>
              </div>
            </Card>
          </div>

          {/* Rules & Thresholds */}
          {autoView?.rule && (
            <Card>
              <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>Rules &amp; Thresholds</h2>
              <form onSubmit={handleSaveRule} style={{ display: "grid", gap: 12 }}>
                <div className="bento-grid cols-3">
                  <div>
                    <label className="bento-label">24h Rain High (mm)</label>
                    <input type="number" className="bento-input mono" value={autoView.rule.rainfall24hHighMm} onChange={(e) => setAutoView({ ...autoView, rule: { ...autoView.rule, rainfall24hHighMm: Number(e.target.value) } })} />
                  </div>
                  <div>
                    <label className="bento-label">24h Rain Severe (mm)</label>
                    <input type="number" className="bento-input mono" value={autoView.rule.rainfall24hSevereMm} onChange={(e) => setAutoView({ ...autoView, rule: { ...autoView.rule, rainfall24hSevereMm: Number(e.target.value) } })} />
                  </div>
                  <div>
                    <label className="bento-label">72h Rain High (mm)</label>
                    <input type="number" className="bento-input mono" value={autoView.rule.rainfall72hHighMm} onChange={(e) => setAutoView({ ...autoView, rule: { ...autoView.rule, rainfall72hHighMm: Number(e.target.value) } })} />
                  </div>
                  <div>
                    <label className="bento-label">River Discharge High (m3/s)</label>
                    <input type="number" className="bento-input mono" value={autoView.rule.riverDischargeHighM3s} onChange={(e) => setAutoView({ ...autoView, rule: { ...autoView.rule, riverDischargeHighM3s: Number(e.target.value) } })} />
                  </div>
                  <div>
                    <label className="bento-label">Cooldown (hours)</label>
                    <input type="number" min={1} className="bento-input mono" value={autoView.rule.cooldownHours} onChange={(e) => setAutoView({ ...autoView, rule: { ...autoView.rule, cooldownHours: Number(e.target.value) } })} />
                  </div>
                  <div>
                    <label className="bento-label">Daily Cap / District</label>
                    <input type="number" min={1} className="bento-input mono" value={autoView.rule.dailyAlertCapPerDistrict} onChange={(e) => setAutoView({ ...autoView, rule: { ...autoView.rule, dailyAlertCapPerDistrict: Number(e.target.value) } })} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input type="text" className="bento-input" style={{ flex: 1, minWidth: 220 }} placeholder="Audit reason for threshold update (required)" value={ruleReason} onChange={(e) => setRuleReason(e.target.value)} />
                  <Button type="submit">Save Rules</Button>
                </div>
              </form>
            </Card>
          )}

          {/* Dry-run & Send test to me */}
          <Card>
            <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>Dry-Run Preview &amp; Staff Test</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select className="bento-select" style={{ width: "auto" }} value={previewDistrict} onChange={(e) => setPreviewDistrict(e.target.value)}>
                {DISTRICTS.filter((d) => d !== "All Districts").map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <Button type="button" variant="secondary" disabled={previewing} onClick={handleDryRun}>
                {previewing ? "Previewing…" : "Dry-run preview"}
              </Button>
              <Button type="button" disabled={testing} onClick={handleTestToMe}>
                {testing ? "Sending…" : "Send test to me"}
              </Button>
            </div>
            {testResult && (
              <div style={{ marginTop: 12 }}>
                <Toast tone={testResult.error ? "critical" : "success"}>{testResult.text}</Toast>
              </div>
            )}
            {dryRun && (
              <div style={{ marginTop: 14, display: "grid", gap: 8, padding: 14, borderRadius: 14, border: "1px solid var(--violet)", background: "var(--violet-tint)" }}>
                <div className="mono" style={{ fontSize: 12 }}>
                  District: <b>{dryRun.district}</b> · Level: <b>{dryRun.evaluatedLevel}</b> · Opted-in verified recipients: <b>{dryRun.eligibleRecipientCount}</b> · Model: <b>{dryRun.modelUsed}</b>
                </div>
                <div style={{ fontSize: 13, color: "#5b21b6" }}><strong>EN:</strong> {dryRun.messageEn}</div>
                <div style={{ fontSize: 13, color: "#5b21b6" }}><strong>SI:</strong> {dryRun.messageSi}</div>
                <div style={{ fontSize: 13, color: "#5b21b6" }}><strong>TA:</strong> {dryRun.messageTa}</div>
              </div>
            )}
          </Card>

          {/* Approval Queue */}
          <Card>
            <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>
              Draft Approval Queue ({autoView?.approvalQueue.length ?? 0})
            </h2>
            {!autoView || autoView.approvalQueue.length === 0 ? (
              <div className="muted" style={{ fontSize: 13.5 }}>No automated alerts waiting for approval.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {autoView.approvalQueue.map((a) => (
                  <div key={a.id} style={{ padding: 14, borderRadius: 14, border: "1px solid var(--border-card)", display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Tag tone="ai">DRAFT</Tag>
                        <Tag tone="warning">{a.district} · {a.triggeredLevel}</Tag>
                        <Tag>{a.modelUsed}</Tag>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button type="button" onClick={() => handleApprove(a.id)}>Approve &amp; Send</Button>
                        <Button type="button" variant="secondary" onClick={() => setRetractTargetId(a.id)}>Retract</Button>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: a.modelUsed !== "template" ? "#5b21b6" : "var(--ink)" }}>{a.messageEn}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* History Table */}
          <Card>
            <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>Automated Alert History</h2>
            {!autoView || autoView.history.length === 0 ? (
              <div className="muted" style={{ fontSize: 13.5 }}>No automated alerts recorded yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-card)", color: "var(--muted)" }}>
                      <th style={{ padding: "8px 8px 8px 0" }}>District</th>
                      <th style={{ padding: "8px" }}>Level</th>
                      <th style={{ padding: "8px" }}>Status</th>
                      <th style={{ padding: "8px" }}>Model</th>
                      <th style={{ padding: "8px" }}>Recipients</th>
                      <th style={{ padding: "8px 0" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoView.history.map((a) => (
                      <tr key={a.id} style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                        <td style={{ padding: "8px 8px 8px 0", fontWeight: 600 }}>{a.district}</td>
                        <td style={{ padding: "8px" }}>{a.triggeredLevel}</td>
                        <td style={{ padding: "8px" }}>
                          <Tag tone={a.status === "Sent" ? "success" : a.status === "Retracted" ? "critical" : "ai"}>{a.status}</Tag>
                          {a.isFalseAlarm && <Tag tone="warning">False alarm</Tag>}
                        </td>
                        <td className="mono" style={{ padding: "8px" }}>{a.modelUsed}</td>
                        <td className="mono" style={{ padding: "8px" }}>{a.recipientCount}</td>
                        <td style={{ padding: "8px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {a.status !== "Retracted" && (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRetractTargetId(a.id)}>Retract</button>
                          )}
                          {!a.isFalseAlarm && (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleMarkFalseAlarm(a.id)}>Not accurate</button>
                          )}
                          <button type="button" className="btn btn-ghost btn-sm" style={{ color: "#DC2626" }} onClick={() => handleDeleteAutomated(a.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Confirm Mode Modal */}
      {pendingMode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.55)", padding: 16 }}>
          <Card style={{ width: "100%", maxWidth: 440 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Switch Automation Mode to {pendingMode}?</h3>
            <p className="muted" style={{ fontSize: 13 }}>This change is audited in PostgreSQL.</p>
            <textarea className="bento-textarea" rows={3} placeholder="Reason (min 5 characters)" value={modeReason} onChange={(e) => setModeReason(e.target.value)} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <Button type="button" variant="secondary" onClick={() => { setPendingMode(null); setModeReason(""); }}>Cancel</Button>
              <Button type="button" disabled={modeReason.trim().length < 5} onClick={handleConfirmModeSwitch}>Confirm</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirm Retract Modal */}
      {retractTargetId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.55)", padding: 16 }}>
          <Card style={{ width: "100%", maxWidth: 440 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Retract Automated Alert</h3>
            <p className="muted" style={{ fontSize: 13 }}>If already sent, a correction email will be queued to recipients.</p>
            <textarea className="bento-textarea" rows={3} placeholder="Reason for retraction (min 5 characters)" value={retractReason} onChange={(e) => setRetractReason(e.target.value)} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <Button type="button" variant="secondary" onClick={() => { setRetractTargetId(null); setRetractReason(""); }}>Cancel</Button>
              <Button type="button" disabled={retractReason.trim().length < 5} onClick={handleConfirmRetract}>Confirm Retract</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
