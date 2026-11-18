"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { Card, EmptyState } from "@/components/ui";
import type { PagedRequestsResult, RequestDetail } from "@/lib/api";

const STATUS_OPTIONS = [
  "All",
  "Submitted",
  "ManualTriage",
  "Approved",
  "Assigned",
  "Dispatched",
  "Fulfilled",
  "Rejected",
  "Cancelled",
];

const PRIORITY_OPTIONS = ["All", "Critical", "High", "Medium", "Low"];

const LANGUAGE_OPTIONS = [
  { value: "All", label: "All languages" },
  { value: "en", label: "English (EN)" },
  { value: "si", label: "Sinhala (SI)" },
  { value: "ta", label: "Tamil (TA)" },
];

const COMMON_DISTRICTS = [
  "All",
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Galle",
  "Matara",
  "Ratnapura",
  "Kurunegala",
  "Jaffna",
  "Batticaloa",
  "Badulla",
  "Anuradhapura",
];

export function AdminRequestsTableClient({
  initialData,
  initialQuery,
}: {
  initialData: PagedRequestsResult;
  initialQuery: {
    search?: string;
    status?: string;
    priority?: string;
    district?: string;
    language?: string;
    page?: number;
    pageSize?: number;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialQuery.search || "");
  const [status, setStatus] = useState(initialQuery.status || "All");
  const [priority, setPriority] = useState(initialQuery.priority || "All");
  const [district, setDistrict] = useState(initialQuery.district || "All");
  const [language, setLanguage] = useState(initialQuery.language || "All");

  function applyFilters(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = {
      search,
      status: status !== "All" ? status : undefined,
      priority: priority !== "All" ? priority : undefined,
      district: district !== "All" ? district : undefined,
      language: language !== "All" ? language : undefined,
      page: 1, // reset to page 1 on filter change
      ...updates,
    };

    Object.entries(merged).forEach(([k, v]) => {
      if (v === undefined || v === "" || v === "All") {
        params.delete(k);
      } else {
        params.set(k, String(v));
      }
    });

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters({ search: search.trim() || undefined, page: 1 });
  }

  function handleResetFilters() {
    setSearch("");
    setStatus("All");
    setPriority("All");
    setDistrict("All");
    setLanguage("All");
    startTransition(() => {
      router.push(pathname);
    });
  }

  function handlePageChange(newPage: number) {
    applyFilters({ page: newPage });
  }

  const { items, totalCount, page, pageSize, totalPages } = initialData;
  const startIdx = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, totalCount);

  const hasActiveFilters = Boolean(
    (initialQuery.search && initialQuery.search.trim()) ||
    (initialQuery.status && initialQuery.status !== "All") ||
    (initialQuery.priority && initialQuery.priority !== "All") ||
    (initialQuery.district && initialQuery.district !== "All") ||
    (initialQuery.language && initialQuery.language !== "All")
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Search and Filters Toolbar */}
      <Card style={{ padding: "16px 20px" }}>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            alignItems: "flex-end",
          }}
        >
          {/* Search input */}
          <div style={{ gridColumn: "span 2" }}>
            <label className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
              SEARCH REQUESTS
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="input"
                placeholder="Search tracking #, description, area, mobile…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: "36px" }}
              />
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>
                <Icon name="search" size={15} />
              </span>
            </div>
          </div>

          {/* Status filter */}
          <div>
            <label className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
              STATUS
            </label>
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                applyFilters({ status: e.target.value, page: 1 });
              }}
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st === "All" ? "All statuses" : st}
                </option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <label className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
              PRIORITY
            </label>
            <select
              className="input"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                applyFilters({ priority: e.target.value, page: 1 });
              }}
            >
              {PRIORITY_OPTIONS.map((pr) => (
                <option key={pr} value={pr}>
                  {pr === "All" ? "All priorities" : pr}
                </option>
              ))}
            </select>
          </div>

          {/* District filter */}
          <div>
            <label className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
              DISTRICT
            </label>
            <select
              className="input"
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                applyFilters({ district: e.target.value, page: 1 });
              }}
            >
              {COMMON_DISTRICTS.map((dist) => (
                <option key={dist} value={dist}>
                  {dist === "All" ? "All districts" : dist}
                </option>
              ))}
            </select>
          </div>

          {/* Language filter */}
          <div>
            <label className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
              LANGUAGE
            </label>
            <select
              className="input"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                applyFilters({ language: e.target.value, page: 1 });
              }}
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter actions */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" className="btn btn-teal btn-sm" disabled={isPending} style={{ flex: 1 }}>
              {isPending ? "Filtering…" : "Search"}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetFilters}
                disabled={isPending}
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </Card>

      {/* Requests Table */}
      {items.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? "No requests match your filter criteria" : "No assistance requests"}
          description={
            hasActiveFilters
              ? "Try broadening your search keyword or resetting the status and priority filters."
              : "No emergency requests have been logged in the system yet. Incoming submissions from citizens will appear here."
          }
        />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-card)", background: "var(--bg-subtle)" }}>
                  <th className="mono" style={{ textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Tracking ID
                  </th>
                  <th className="mono" style={{ textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Category &amp; Need
                  </th>
                  <th className="mono" style={{ textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    District / Area
                  </th>
                  <th className="mono" style={{ textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Lang
                  </th>
                  <th className="mono" style={{ textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    AI Priority &amp; Conf.
                  </th>
                  <th className="mono" style={{ textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Status
                  </th>
                  <th className="mono" style={{ textAlign: "right", padding: "14px 18px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r: RequestDetail) => {
                  const confPct = Math.round(
                    r.aiConfidence !== undefined && r.aiConfidence !== null
                      ? (r.aiConfidence <= 1 ? r.aiConfidence * 100 : r.aiConfidence)
                      : (r.urgencyScore || 50)
                  );
                  const pri = r.aiPriority || r.priority || "Medium";

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: "1px solid var(--border-card)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* Tracking ID */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                        <Link
                          href={`/admin/requests/${r.trackingNumber || r.id}`}
                          className="mono"
                          style={{
                            color: "var(--accent)",
                            fontWeight: 700,
                            textDecoration: "none",
                            fontSize: "13px",
                          }}
                        >
                          #{r.trackingNumber || r.id.substring(0, 8)}
                        </Link>
                        <div className="muted" style={{ fontSize: "11px", marginTop: "2px" }}>
                          {new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {/* Need & Category */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle", maxWidth: "340px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span className="tag tag-teal" style={{ fontSize: "11px", padding: "2px 8px" }}>
                            {r.category}
                          </span>
                          {r.peopleCount > 1 && (
                            <span className="tag tag-muted" style={{ fontSize: "11px" }}>
                              {r.peopleCount} people
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            color: "var(--ink)",
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={r.description}
                        >
                          {r.description}
                        </div>
                      </td>

                      {/* Area */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <b>{r.area || "Sri Lanka"}</b>
                      </td>

                      {/* Language */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                        <span className="tag tag-muted mono" style={{ fontSize: "10.5px" }}>
                          {(r.language || "en").toUpperCase()}
                        </span>
                      </td>

                      {/* AI Priority & Confidence pill */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <span
                          className="tag"
                          style={{
                            background: "var(--violet-tint)",
                            color: "var(--violet)",
                            fontWeight: 700,
                            fontSize: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            borderRadius: "14px",
                            border: "1px solid rgba(124, 58, 237, 0.25)",
                          }}
                        >
                          <Icon name="sparkle" size={12} />
                          {pri.toUpperCase()} · {confPct}%
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <span
                          className={`tag ${
                            r.status === "Approved" || r.status === "Assigned"
                              ? "tag-mint"
                              : r.status === "Rejected"
                              ? "tag-coral"
                              : r.status === "ManualTriage" || r.status === "Under review"
                              ? "tag-sun"
                              : "tag-muted"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                        <Link
                          href={`/admin/requests/${r.trackingNumber || r.id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: "12px" }}
                        >
                          Inspect &amp; Decide →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Server-Side Pagination Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 20px",
              background: "var(--bg-subtle)",
              borderTop: "1px solid var(--border-card)",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div className="mono muted" style={{ fontSize: "12px" }}>
              Showing <b>{startIdx}–{endIdx}</b> of <b>{totalCount}</b> assistance requests
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1 || isPending}
                onClick={() => handlePageChange(page - 1)}
              >
                ← Previous
              </button>

              <span className="mono" style={{ fontSize: "12px", padding: "0 6px" }}>
                Page <b>{page}</b> of <b>{Math.max(1, totalPages)}</b>
              </span>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages || isPending}
                onClick={() => handlePageChange(page + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
