"use client";

import { useState } from "react";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            <span className="h-2 w-2 rounded-full bg-violet-600" />
            AI Governance &amp; Fairness
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            AI Controls, Calibration &amp; Override Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            AI only recommends; humans decide. Every mode switch and threshold change is audited in PostgreSQL.
          </p>
        </div>

        <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-2.5 text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
            Live AI Mode
          </div>
          <div className="text-lg font-bold text-violet-900">{currentMode}</div>
          {gov?.config?.updatedAt && (
            <div className="text-[11px] text-violet-700">
              Updated {new Date(gov.config.updatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* Mode Switch + Threshold Settings */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Operating Mode (Kill Switch)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Takes effect immediately for all incoming assistance requests.
          </p>
          <div className="mt-4 grid gap-3">
            {MODES.map((m) => {
              const active = currentMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    if (!active) setPendingMode(m.value);
                  }}
                  className={`rounded-xl border p-3.5 text-left transition ${
                    active
                      ? "border-violet-500 bg-violet-50/80 ring-1 ring-violet-500"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">{m.title}</span>
                    {active ? (
                      <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        Active Setting
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500">Switch &rarr;</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Confidence &amp; Fairness Thresholds</h2>
          <p className="mt-1 text-xs text-slate-500">
            Requests below confidence threshold are flagged &ldquo;Needs human review&rdquo; with suggested actions hidden.
          </p>
          <form onSubmit={handleSaveThresholds} className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span>Minimum Confidence Threshold</span>
                <span className="font-mono font-semibold text-violet-700">
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
                className="mt-2 w-full accent-violet-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span>Fairness Disparity Alert Threshold</span>
                <span className="font-mono font-semibold text-violet-700">
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
                className="mt-2 w-full accent-violet-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Audit Reason (required)
              </label>
              <input
                type="text"
                value={thresholdReason}
                onChange={(e) => setThresholdReason(e.target.value)}
                placeholder="e.g. Tightening review gate during peak flood intake"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={savingThresholds}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {savingThresholds ? "Saving..." : "Save Thresholds"}
            </button>
          </form>
        </section>
      </div>

      {/* Override Analytics */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Override &amp; Agreement Analytics</h2>
            <p className="text-xs text-slate-500">
              {analytics
                ? `${analytics.totalDecisions ?? 0} human decisions analyzed · Overall agreement ${Math.round(
                    (analytics.overallAgreementRate ?? 0) * 100
                  )}%`
                : "No analytics loaded"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
            />
            <button
              type="button"
              onClick={refreshAnalytics}
              disabled={loadingAnalytics}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {loadingAnalytics ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 border-b border-slate-200 pb-2">
          {(["day", "language", "district", "category"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                activeTab === tab
                  ? "bg-violet-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              By {tab}
            </button>
          ))}
        </div>

        {breakdownRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No human triage decisions recorded in this period yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {breakdownRows.map((row) => {
              const total = Math.max(1, row.total);
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{row.key}</span>
                    <span className="text-slate-500">
                      {row.approved} approved · {row.modified} modified · {row.rejected} rejected ·{" "}
                      {row.deferred} deferred ({Math.round(row.agreementRate * 100)}% agreement)
                    </span>
                  </div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      style={{ width: `${(row.approved / total) * 100}%` }}
                      className="bg-emerald-600"
                      title={`Approved: ${row.approved}`}
                    />
                    <div
                      style={{ width: `${(row.modified / total) * 100}%` }}
                      className="bg-amber-500"
                      title={`Modified: ${row.modified}`}
                    />
                    <div
                      style={{ width: `${(row.rejected / total) * 100}%` }}
                      className="bg-rose-500"
                      title={`Rejected: ${row.rejected}`}
                    />
                    <div
                      style={{ width: `${(row.deferred / total) * 100}%` }}
                      className="bg-slate-400"
                      title={`Deferred: ${row.deferred}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Calibration + Fairness */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Confidence Calibration</h2>
          <p className="mt-1 text-xs text-slate-500">
            Average AI confidence vs observed human agreement rate across confidence buckets.
          </p>
          {!analytics || !Array.isArray(analytics.calibration) || analytics.calibration.every((b) => b.count === 0) ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No calibrated decision buckets yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {analytics.calibration.map((b) => (
                <div key={b.rangeLabel} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-slate-800">{b.rangeLabel}</span>
                    <span className="text-slate-500">
                      n={b.count} · Conf {Math.round(b.avgConfidence * 100)}% vs Agree{" "}
                      {Math.round(b.agreementRate * 100)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        style={{ width: `${Math.round(b.avgConfidence * 100)}%` }}
                        className="h-2 rounded-full bg-violet-500"
                      />
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        style={{ width: `${Math.round(b.agreementRate * 100)}%` }}
                        className="h-2 rounded-full bg-emerald-600"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 pt-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-violet-500" /> AI Confidence
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" /> Human Agreement
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Fairness Check (Language &amp; District)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Flags groups whose Critical/High rate or agreement diverges by more than{" "}
            {Math.round((analytics?.fairnessDisparityThreshold ?? fairnessThreshold) * 100)}%.
          </p>
          {!analytics || !Array.isArray(analytics.fairness) || analytics.fairness.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No requests available for fairness comparison yet.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Group</th>
                    <th className="py-2 pr-3 font-semibold">Requests</th>
                    <th className="py-2 pr-3 font-semibold">High/Crit</th>
                    <th className="py-2 pr-3 font-semibold">Disparity</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.fairness.map((row) => (
                    <tr key={`${row.dimension}:${row.group}`}>
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        <span className="text-slate-400">{row.dimension}: </span>
                        {row.group}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{row.totalRequests}</td>
                      <td className="py-2 pr-3 text-slate-700">
                        {Math.round(row.criticalOrHighRate * 100)}%
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-700">
                        {Math.round(row.disparityFromMean * 100)}%
                      </td>
                      <td className="py-2">
                        {row.flagged ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
                            Flagged
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                            Balanced
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Audit History */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Governance Audit Log</h2>
        {!gov || !Array.isArray(gov.auditHistory) || gov.auditHistory.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            No governance changes recorded yet.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Seq</th>
                  <th className="py-2 pr-3 font-semibold">Actor</th>
                  <th className="py-2 pr-3 font-semibold">Timestamp (UTC)</th>
                  <th className="py-2 font-semibold">Change Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gov.auditHistory.map((ev) => (
                  <tr key={ev.sequenceNumber}>
                    <td className="py-2 pr-3 font-mono text-slate-600">#{ev.sequenceNumber}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{ev.actorId}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {new Date(ev.timestampUtc).toLocaleString()}
                    </td>
                    <td className="py-2 font-mono text-[11px] text-slate-600">{ev.detailsJson}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Confirm Mode Modal */}
      {pendingMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Switch AI Mode to {pendingMode}?
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              This takes effect immediately and will be recorded in the immutable audit log.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">
                Reason for mode change (required)
              </label>
              <textarea
                rows={3}
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                placeholder="Explain why AI mode is being changed..."
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingMode(null);
                  setModalReason("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingMode || modalReason.trim().length < 5}
                onClick={handleConfirmModeSwitch}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {savingMode ? "Switching..." : `Confirm ${pendingMode}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
