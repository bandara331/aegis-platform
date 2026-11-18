"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, StatCard } from "@/components/ui";
import type { SituationReportDraftDto } from "@/lib/api/types";

interface KpiReport {
  fromUtc: string;
  toUtc: string;
  totalRequests: number;
  resolvedRequests: number;
  openRequests: number;
  criticalRequests: number;
  totalDecisions: number;
  aiOverrides: number;
  totalDonationsLkr: number;
  flaggedDonations: number;
  sheltersCount: number;
  shelterOccupancy: number;
  shelterCapacity: number;
  resourceUnitsAvailable: number;
  volunteersCount: number;
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byDistrict: { district: string; count: number }[];
}

function isoDate(daysOffset: number) {
  const d = new Date(Date.now() + daysOffset * 86400000);
  return d.toISOString().slice(0, 10);
}

export default function AdminReportsPage() {
  const [from, setFrom] = useState(isoDate(-30));
  const [to, setTo] = useState(isoDate(0));
  const [report, setReport] = useState<KpiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<SituationReportDraftDto[]>([]);
  const [activeDraft, setActiveDraft] = useState<SituationReportDraftDto | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMsg, setDraftMsg] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/ai/reports/drafts", { cache: "no-store" });
      if (res.ok) {
        const list = (await res.json()) as SituationReportDraftDto[];
        setDrafts(Array.isArray(list) ? list : []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/reports/kpis?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`Failed to load KPI report (HTTP ${res.status}).`);
        return;
      }
      setReport((await res.json()) as KpiReport);
    } catch {
      setError("Unable to reach reports API.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void loadReport();
    void loadDrafts();
  }, [loadReport, loadDrafts]);

  async function handleGenerateDraft() {
    setDraftBusy(true);
    setDraftMsg(null);
    try {
      const res = await fetch("/api/ops/ai/reports/daily-draft", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setDraftMsg(data.error || "Failed to generate draft.");
      } else {
        const d = data as SituationReportDraftDto;
        setActiveDraft(d);
        setDraftTitle(d.title);
        setDraftContent(d.contentMarkdown);
        await loadDrafts();
      }
    } catch {
      setDraftMsg("Unable to reach AI reports endpoint.");
    } finally {
      setDraftBusy(false);
    }
  }

  async function handleSaveDraft() {
    if (!activeDraft) return;
    setDraftBusy(true);
    setDraftMsg(null);
    try {
      const res = await fetch(`/api/ops/ai/reports/drafts/${activeDraft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle, contentMarkdown: draftContent }),
      });
      const data = await res.json();
      if (!res.ok) setDraftMsg(data.error || "Failed to save draft.");
      else {
        setActiveDraft(data as SituationReportDraftDto);
        setDraftMsg("Draft saved.");
        await loadDrafts();
      }
    } finally {
      setDraftBusy(false);
    }
  }

  async function handlePublishDraft() {
    if (!activeDraft) return;
    setDraftBusy(true);
    setDraftMsg(null);
    try {
      const res = await fetch(`/api/ops/ai/reports/drafts/${activeDraft.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setDraftMsg(data.error || "Failed to publish.");
      else {
        setActiveDraft(data as SituationReportDraftDto);
        setDraftMsg("Report approved and published.");
        await loadDrafts();
      }
    } finally {
      setDraftBusy(false);
    }
  }

  function exportCsv() {
    if (!report) return;
    const rows: string[][] = [
      ["Metric", "Value"],
      ["From", report.fromUtc],
      ["To", report.toUtc],
      ["Total Requests", String(report.totalRequests)],
      ["Open Requests", String(report.openRequests)],
      ["Resolved Requests", String(report.resolvedRequests)],
      ["Critical Requests", String(report.criticalRequests)],
      ["Coordinator Decisions", String(report.totalDecisions)],
      ["AI Overrides (Edit/Reject)", String(report.aiOverrides)],
      ["Verified Donations (LKR)", String(report.totalDonationsLkr)],
      ["Flagged Donations", String(report.flaggedDonations)],
      ["Shelters Occupancy", `${report.shelterOccupancy}/${report.shelterCapacity}`],
      ["Resource Units Available", String(report.resourceUnitsAvailable)],
      ["Registered Volunteers", String(report.volunteersCount)],
      [],
      ["Category", "Requests"],
      ...report.byCategory.map((c) => [c.category, String(c.count)]),
      [],
      ["District", "Requests"],
      ...report.byDistrict.map((d) => [d.district, String(d.count)]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow="POST-INCIDENT REVIEW"
        eyebrowTone="accent"
        title="Analytical & Accountability Reports"
        subtitle="Real KPIs aggregated from PostgreSQL by date range, with one-click CSV export."
      />

      <Card>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div>
              <label className="bento-label">From date</label>
              <input type="date" className="bento-input mono" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="bento-label">To date</label>
              <input type="date" className="bento-input mono" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button type="button" onClick={loadReport} disabled={loading}>
              {loading ? "Loading…" : "Apply range"}
            </Button>
          </div>
          <Button type="button" variant="secondary" onClick={exportCsv} disabled={!report}>
            Export CSV
          </Button>
        </div>
      </Card>

      {error ? (
        <ErrorState message={error} />
      ) : !report ? (
        <EmptyState title="No report data loaded" description="Select a date range above to load real KPIs." />
      ) : (
        <>
          <div className="bento-grid cols-4">
            <StatCard label="Total requests" value={report.totalRequests} tone="accent" />
            <StatCard label="Open / active" value={report.openRequests} tone="warning" />
            <StatCard label="Decisions (AI overrides)" value={`${report.totalDecisions} (${report.aiOverrides})`} tone="ai" />
            <StatCard label="Verified donations" value={`LKR ${Number(report.totalDonationsLkr).toLocaleString()}`} tone="success" />
          </div>

          <div className="bento-grid cols-2">
            <Card>
              <h3 style={{ margin: "0 0 10px" }}>By category</h3>
              {report.byCategory.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>No requests in this date range.</div>
              ) : (
                report.byCategory.map((c) => (
                  <div key={c.category} className="kv">
                    <span>{c.category}</span>
                    <b className="mono">{c.count}</b>
                  </div>
                ))
              )}
            </Card>
            <Card>
              <h3 style={{ margin: "0 0 10px" }}>By district</h3>
              {report.byDistrict.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>No requests in this date range.</div>
              ) : (
                report.byDistrict.map((d) => (
                  <div key={d.district} className="kv">
                    <span>{d.district}</span>
                    <b className="mono">{d.count}</b>
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}

      {/* AI-Assisted Daily Situation Report Draft Editor */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <span className="tag tag-ai">AI-assisted draft</span>
            <h3 style={{ margin: "6px 0 2px" }}>Daily Situation Report</h3>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              Built strictly from database aggregates and stored weather snapshots. Humans edit, approve, and publish.
            </p>
          </div>
          <Button type="button" onClick={handleGenerateDraft} disabled={draftBusy}>
            {draftBusy ? "Working…" : "Generate Daily Draft"}
          </Button>
        </div>

        {draftMsg && (
          <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(124,58,237,0.08)", color: "var(--violet)", fontSize: 13 }}>
            {draftMsg}
          </div>
        )}

        {activeDraft ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="text"
              className="bento-input"
              value={draftTitle}
              disabled={activeDraft.status === "Published"}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
            <textarea
              rows={12}
              className="bento-input mono"
              style={{ fontSize: 12.5, width: "100%" }}
              value={draftContent}
              disabled={activeDraft.status === "Published"}
              onChange={(e) => setDraftContent(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="tag tag-muted">{activeDraft.status}</span>
              {activeDraft.status !== "Published" && (
                <>
                  <Button type="button" variant="secondary" onClick={handleSaveDraft} disabled={draftBusy}>
                    Save edits
                  </Button>
                  <Button type="button" onClick={handlePublishDraft} disabled={draftBusy}>
                    Approve &amp; Publish
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            title="No draft selected"
            description="Click 'Generate Daily Draft' to compile real database counts and stored weather snapshots."
          />
        )}

        {drafts.length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--border-card)", paddingTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Recent drafts &amp; published reports</div>
            {drafts.map((d) => (
              <div key={d.id} className="kv" style={{ cursor: "pointer" }} onClick={() => { setActiveDraft(d); setDraftTitle(d.title); setDraftContent(d.contentMarkdown); }}>
                <span>{d.title}</span>
                <span className="tag tag-muted">{d.status}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
