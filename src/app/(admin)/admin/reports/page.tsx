"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, StatCard } from "@/components/ui";

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
  }, [loadReport]);

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
    </div>
  );
}
