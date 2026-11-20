"use client";

import { useState } from "react";
import { Card, ErrorState, PageHeader, Tag } from "@/components/ui";
import type {
  AiAnalyticsDto,
  AiBreakdownBucketDto,
  AiGovernanceViewDto,
} from "@/lib/api/types";

interface Props {
  initialGovernance: AiGovernanceViewDto | null;
  initialAnalytics: AiAnalyticsDto | null;
  initialError: string | null;
}

const MODES: Array<{ value: "Active" | "Shadow" | "Off"; title: string; desc: string }> = [
  {
    value: "Active",
    title: "Active",
    desc: "AI recommendations are scored and shown to staff. Below-threshold requests route to Needs human review.",
  },
  {
    value: "Shadow",
    title: "Shadow",
    desc: "AI scores silently in the background for evaluation; hidden from staff UI and routed to ManualTriage.",
  },
  {
    value: "Off",
    title: "Off (Kill Switch)",
    desc: "AI scoring paused immediately. All incoming requests go to ManualTriage with an 'AI paused' banner.",
  },
];

export default function AiGovernanceClient({
  initialGovernance,
  initialAnalytics,
  initialError,
}: Props) {
  const [gov, setGov] = useState<AiGovernanceViewDto | null>(initialGovernance);
  const [analytics, setAnalytics] = useState<AiAnalyticsDto | null>(initialAnalytics);
  const [error, setError] = useState<string | null>(initialError);

  const [pendingMode, setPendingMode] = useState<"Active" | "Shadow" | "Off" | null>(null);
  const [modalReason, setModalReason] = useState("");
  const [savingMode, setSavingMode] = useState(false);

  const [confThreshold, setConfThreshold] = useState<number>(
    initialGovernance?.config?.confidenceThreshold ?? 0.6
  );
  const [fairnessThreshold, setFairnessThreshold] = useState<number>(
    initialGovernance?.config?.fairnessDisparityThreshold ?? 0.15
  );
  const [thresholdReason, setThresholdReason] = useState("");
  const [savingThresholds, setSavingThresholds] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<"day" | "language" | "district" | "category">("day");

  const currentMode = (gov?.config?.mode ?? "Active") as "Active" | "Shadow" | "Off";

  async function saveGovernanceUpdate(payload: {
    mode?: string;
    confidenceThreshold?: number;
    fairnessDisparityThreshold?: number;
    reason: string;
  }) {
    const res = await fetch("/api/ops/admin/ai/governance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    const updated = data as AiGovernanceViewDto;
    setGov(updated);
    if (updated?.config) {
      setConfThreshold(updated.config.confidenceThreshold ?? 0.6);
      setFairnessThreshold(updated.config.fairnessDisparityThreshold ?? 0.15);
    }
  }

  async function handleConfirmModeSwitch() {
    if (!pendingMode || modalReason.trim().length < 5) return;
    setSavingMode(true);
    setError(null);
    try {
      await saveGovernanceUpdate({ mode: pendingMode, reason: modalReason.trim() });
      setPendingMode(null);
      setModalReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update AI mode.");
    } finally {
      setSavingMode(false);
    }
  }

  async function handleSaveThresholds(e: React.FormEvent) {
    e.preventDefault();
    if (thresholdReason.trim().length < 5) {
      setError("Please provide an audit reason (at least 5 characters) to update thresholds.");
      return;
    }
    setSavingThresholds(true);
    setError(null);
    try {
      await saveGovernanceUpdate({
        confidenceThreshold: confThreshold,
        fairnessDisparityThreshold: fairnessThreshold,
        reason: thresholdReason.trim(),
      });
      setThresholdReason("");
      await refreshAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update thresholds.");
    } finally {
      setSavingThresholds(false);
    }
  }

  async function refreshAnalytics() {
    setLoadingAnalytics(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (fromDate) qs.set("from", fromDate);
      if (toDate) qs.set("to", toDate);
      const query = qs.toString() ? `?${qs.toString()}` : "";
      const res = await fetch(`/api/ops/admin/ai/analytics${query}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Failed to load analytics (HTTP ${res.status})`);
      } else {
        setAnalytics(data as AiAnalyticsDto);
      }
    } catch {
      setError("Unable to reach AI analytics endpoint.");
    } finally {
      setLoadingAnalytics(false);
    }
  }

  const breakdownRows: AiBreakdownBucketDto[] =
    activeTab === "day"
      ? analytics?.byDay ?? []
      : activeTab === "language"
        ? analytics?.byLanguage ?? []
        : activeTab === "district"
          ? analytics?.byDistrict ?? []
          : analytics?.byCategory ?? [];

  const modeTone = currentMode === "Active" ? "success" : currentMode === "Shadow" ? "warning" : "critical";

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow="AI GOVERNANCE & FAIRNESS"
        eyebrowTone="ai"
        title="AI Controls, Calibration & Override Analytics"
        subtitle="AI only recommends; humans decide. Every mode switch and threshold change is audited in PostgreSQL."
        actions={
          <div style={{ textAlign: "right" }}>
            <Tag tone={modeTone} pulse={currentMode === "Active"}>
              LIVE MODE · {currentMode.toUpperCase()}
            </Tag>
            {gov?.config?.updatedAt && (
              <div className="mono" style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                Updated {new Date(gov.config.updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        }
      />

      {error && <ErrorState message={error} />}

      {/* Mode Switch + Threshold Settings */}
      <div className="bento-grid cols-2">
        <Card aiHighlight>
          <div style={{ marginBottom: 14 }}>
            <Tag tone="ai">OPERATING MODE (KILL SWITCH)</Tag>
            <h2 style={{ margin: "8px 0 4px", fontSize: 18, fontWeight: 700 }}>
              Triage Operating Mode
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Takes effect immediately for all incoming assistance requests.
            </p>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {MODES.map((m) => {
              const active = currentMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    if (!active) setPendingMode(m.value);
                  }}
                  style={{
                    textAlign: "left",
                    padding: "14px 16px",
                    borderRadius: "var(--r-md)",
                    border: active ? "2px solid var(--violet)" : "1px solid var(--border-card)",
                    background: active ? "var(--violet-tint)" : "rgba(255,255,255,0.72)",
                    cursor: active ? "default" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14, color: "var(--ink)" }}>{m.title}</strong>
                    {active ? (
                      <Tag tone="ai">ACTIVE SETTING</Tag>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--teal)" }}>
                        Switch &rarr;
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
                    {m.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <div style={{ marginBottom: 14 }}>
            <Tag tone="ai">CALIBRATION GATES</Tag>
            <h2 style={{ margin: "8px 0 4px", fontSize: 18, fontWeight: 700 }}>
              Confidence &amp; Fairness Thresholds
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Requests below confidence threshold are flagged &ldquo;Needs human review&rdquo; with suggested actions hidden.
            </p>
          </div>

          <form onSubmit={handleSaveThresholds} style={{ display: "grid", gap: 16 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                <span>Minimum Confidence Threshold</span>
                <span className="mono" style={{ color: "var(--violet)" }}>
                  {Math.round(confThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.99}
                step={0.05}
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                style={{ width: "100%", marginTop: 8, accentColor: "var(--violet)" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                <span>Fairness Disparity Alert Threshold</span>
                <span className="mono" style={{ color: "var(--violet)" }}>
                  {Math.round(fairnessThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.5}
                step={0.05}
                value={fairnessThreshold}
                onChange={(e) => setFairnessThreshold(parseFloat(e.target.value))}
                style={{ width: "100%", marginTop: 8, accentColor: "var(--violet)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                Audit Reason (required)
              </label>
              <input
                type="text"
                className="input"
                value={thresholdReason}
                onChange={(e) => setThresholdReason(e.target.value)}
                placeholder="e.g. Tightening review gate during peak flood intake"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={savingThresholds}
                className="btn btn-primary btn-sm"
              >
                {savingThresholds ? "Saving..." : "Save Thresholds"}
              </button>
            </div>
          </form>
        </Card>
      </div>

      {/* Override Analytics */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Override &amp; Agreement Analytics
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
              {analytics
                ? `${analytics.totalDecisions ?? 0} human decisions analyzed · Overall agreement ${Math.round(
                    (analytics.overallAgreementRate ?? 0) * 100
                  )}%`
                : "No analytics loaded"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <input
              type="date"
              className="input"
              style={{ width: "auto", minHeight: 36, padding: "4px 10px", fontSize: 12.5 }}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>to</span>
            <input
              type="date"
              className="input"
              style={{ width: "auto", minHeight: 36, padding: "4px 10px", fontSize: 12.5 }}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <button
              type="button"
              onClick={refreshAnalytics}
              disabled={loadingAnalytics}
              className="btn btn-ghost btn-sm"
            >
              {loadingAnalytics ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>

        <div className="pills" style={{ marginTop: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-card)" }}>
          {(["day", "language", "district", "category"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`pill ${activeTab === tab ? "on" : ""}`}
              style={{ textTransform: "capitalize" }}
            >
              By {tab}
            </button>
          ))}
        </div>

        {breakdownRows.length === 0 ? (
          <div style={{ padding: "36px 12px", textAlign: "center", fontSize: 14, color: "var(--muted)" }}>
            No human triage decisions recorded in this period yet.
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {breakdownRows.map((row) => {
              const total = Math.max(1, row.total);
              return (
                <div key={row.key} style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ color: "var(--ink)" }}>{row.key}</strong>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      {row.approved} approved · {row.modified} modified · {row.rejected} rejected ·{" "}
                      {row.deferred} deferred ({Math.round((row.agreementRate ?? 0) * 100)}% agreement)
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      height: 10,
                      width: "100%",
                      overflow: "hidden",
                      borderRadius: 999,
                      background: "rgba(15, 23, 42, 0.08)",
                    }}
                  >
                    <div style={{ width: `${(row.approved / total) * 100}%`, background: "#059669" }} title={`Approved: ${row.approved}`} />
                    <div style={{ width: `${(row.modified / total) * 100}%`, background: "#d97706" }} title={`Modified: ${row.modified}`} />
                    <div style={{ width: `${(row.rejected / total) * 100}%`, background: "#e11d48" }} title={`Rejected: ${row.rejected}`} />
                    <div style={{ width: `${(row.deferred / total) * 100}%`, background: "#94a3b8" }} title={`Deferred: ${row.deferred}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Calibration + Fairness */}
      <div className="bento-grid cols-2">
        <Card>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Confidence Calibration</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Average AI confidence vs observed human agreement rate across confidence buckets.
          </p>
          {!analytics || !Array.isArray(analytics.calibration) || analytics.calibration.every((b) => b.count === 0) ? (
            <div style={{ padding: "36px 12px", textAlign: "center", fontSize: 14, color: "var(--muted)" }}>
              No calibrated decision buckets yet.
            </div>
          ) : (
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              {analytics.calibration.map((b) => (
                <div key={b.rangeLabel} style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span className="mono" style={{ fontWeight: 700 }}>{b.rangeLabel}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      n={b.count} · Conf {Math.round(b.avgConfidence * 100)}% vs Agree{" "}
                      {Math.round(b.agreementRate * 100)}%
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ height: 8, width: "100%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }}>
                      <div style={{ height: 8, width: `${Math.round(b.avgConfidence * 100)}%`, borderRadius: 999, background: "var(--violet)" }} />
                    </div>
                    <div style={{ height: 8, width: "100%", borderRadius: 999, background: "rgba(15,23,42,0.08)" }}>
                      <div style={{ height: 8, width: `${Math.round(b.agreementRate * 100)}%`, borderRadius: 999, background: "#059669" }} />
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 16, paddingTop: 6, fontSize: 11.5, color: "var(--muted)" }}>
                <span>● AI Confidence (violet)</span>
                <span>● Human Agreement (green)</span>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Fairness Check (Language &amp; District)
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Flags groups whose Critical/High rate or agreement diverges by more than{" "}
            {Math.round((analytics?.fairnessDisparityThreshold ?? fairnessThreshold) * 100)}%.
          </p>
          {!analytics || !Array.isArray(analytics.fairness) || analytics.fairness.length === 0 ? (
            <div style={{ padding: "36px 12px", textAlign: "center", fontSize: 14, color: "var(--muted)" }}>
              No requests available for fairness comparison yet.
            </div>
          ) : (
            <div style={{ marginTop: 14, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-card)", color: "var(--muted)" }}>
                    <th style={{ padding: "8px 10px 8px 0" }}>Group</th>
                    <th style={{ padding: "8px 10px" }}>Requests</th>
                    <th style={{ padding: "8px 10px" }}>High/Crit</th>
                    <th style={{ padding: "8px 10px" }}>Disparity</th>
                    <th style={{ padding: "8px 0" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.fairness.map((row) => (
                    <tr key={`${row.dimension}:${row.group}`} style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                      <td style={{ padding: "8px 10px 8px 0", fontWeight: 600 }}>
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}>{row.dimension}: </span>
                        {row.group}
                      </td>
                      <td style={{ padding: "8px 10px" }}>{row.totalRequests}</td>
                      <td style={{ padding: "8px 10px" }}>{Math.round(row.criticalOrHighRate * 100)}%</td>
                      <td className="mono" style={{ padding: "8px 10px" }}>{Math.round(row.disparityFromMean * 100)}%</td>
                      <td style={{ padding: "8px 0" }}>
                        <Tag tone={row.flagged ? "critical" : "success"}>
                          {row.flagged ? "Flagged" : "Balanced"}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Audit History */}
      <Card>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>Governance Audit Log</h2>
        {!gov || !Array.isArray(gov.auditHistory) || gov.auditHistory.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", fontSize: 14, color: "var(--muted)" }}>
            No governance changes recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-card)", color: "var(--muted)" }}>
                  <th style={{ padding: "8px 10px 8px 0" }}>Seq</th>
                  <th style={{ padding: "8px 10px" }}>Actor</th>
                  <th style={{ padding: "8px 10px" }}>Timestamp (UTC)</th>
                  <th style={{ padding: "8px 0" }}>Change Details</th>
                </tr>
              </thead>
              <tbody>
                {gov.auditHistory.map((ev) => (
                  <tr key={ev.sequenceNumber} style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                    <td className="mono" style={{ padding: "8px 10px 8px 0" }}>#{ev.sequenceNumber}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{ev.actorId}</td>
                    <td style={{ padding: "8px 10px", color: "var(--muted)" }}>
                      {new Date(ev.timestampUtc).toLocaleString()}
                    </td>
                    <td className="mono" style={{ padding: "8px 0", fontSize: 11.5, color: "var(--muted)" }}>
                      {ev.detailsJson}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Confirm Mode Modal */}
      {pendingMode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(6px)",
            padding: 16,
          }}
        >
          <Card style={{ width: "100%", maxWidth: 460 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Switch AI Mode to {pendingMode}?
            </h3>
            <p style={{ margin: "6px 0 14px", fontSize: 13.5, color: "var(--muted)" }}>
              This takes effect immediately and will be recorded in the immutable audit log.
            </p>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                Reason for mode change (required)
              </label>
              <textarea
                rows={3}
                className="textarea"
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                placeholder="Explain why AI mode is being changed..."
              />
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setPendingMode(null);
                  setModalReason("");
                }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingMode || modalReason.trim().length < 5}
                onClick={handleConfirmModeSwitch}
                className="btn btn-primary btn-sm"
              >
                {savingMode ? "Switching..." : `Confirm ${pendingMode}`}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
