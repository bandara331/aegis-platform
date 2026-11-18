import Link from "next/link";
import {
  getKpis,
  getPendingRecommendations,
  getQueue,
  getShelters,
  getStockForecasts,
  type QueueItem,
} from "@/lib/api";
import { Icon } from "@/components/icons/Icon";
import { EmptyState, ErrorState } from "@/components/ui";
import { AiSuggestionPanel } from "./AiSuggestionPanel";

const SPARK_COLORS = ["#FF5A4F", "#FFC94A", "#7C3AED", "#2FD6A3"];
const SPARK_FILLS = ["#FFE7E4", "#FFF3D1", "#ECE7FF", "#D9F8EE"];

function priorityTagClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "critical") return "tag tag-coral";
  if (p === "high") return "tag tag-sun";
  return "tag tag-teal";
}

function KanbanCard({ item, highlighted }: { item: QueueItem; highlighted?: boolean }) {
  return (
    <Link
      href={`/admin/requests/${item.id}`}
      className={`kb-card ${highlighted ? "selected" : ""}`.trim()}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div className="kb-card-top">
        <span className="kb-id">#{item.id}</span>
        <span className={priorityTagClass(item.priority)}>
          {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
        </span>
      </div>
      <div className="kb-need">{item.need}</div>
      <div className="kb-foot">
        <span>{item.area}</span>
        <span className="mono">{item.wait}</span>
      </div>
    </Link>
  );
}

export default async function AdminOverviewPage() {
  const [kpiRes, queueRes, recsRes, sheltersRes, forecastRes] = await Promise.all([
    getKpis(),
    getQueue(),
    getPendingRecommendations(),
    getShelters(),
    getStockForecasts(),
  ]);

  const queue = queueRes.data;
  const needsReview = queue.filter((q) => {
    const s = q.status.toLowerCase();
    return s.includes("new") || s.includes("review") || s.includes("pending") || s.includes("triage");
  });
  const assigned = queue.filter((q) => {
    const s = q.status.toLowerCase();
    return s.includes("assign") || s.includes("approved");
  });
  const onTheWay = queue.filter((q) => {
    const s = q.status.toLowerCase();
    return s.includes("way") || s.includes("transit") || s.includes("dispatch") || s.includes("progress");
  });

  // If statuses have other names, ensure all queue items remain visible in Needs review
  const categorizedIds = new Set([...needsReview, ...assigned, ...onTheWay].map((i) => i.id));
  const uncategorized = queue.filter((q) => !categorizedIds.has(q.id));
  const colNeedsReview = [...needsReview, ...uncategorized];

  const firstRecommendation = recsRes.data[0] ?? null;

  return (
    <div className="ov">
      <div className="ov-main">
        {/* Header */}
        <div className="ov-head">
          <div>
            <span className="eyebrow" style={{ color: "var(--coral)" }}>
              Command overview
            </span>
            <h1 style={{ marginTop: "4px" }}>Operations board</h1>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Link href="/admin/alerts" className="btn btn-ghost btn-sm">
              <Icon name="bell" size={14} /> Send alert
            </Link>
            <Link href="/admin/requests" className="btn btn-coral btn-sm">
              <Icon name="plus" size={14} /> View all requests
            </Link>
          </div>
        </div>

        {/* 4 KPI cards with sparklines */}
        {kpiRes.error ? (
          <ErrorState message={kpiRes.error} />
        ) : kpiRes.data.length === 0 ? (
          <EmptyState
            title="No operational KPIs recorded yet"
            description="Metrics will populate automatically from live requests, AI triage recommendations, and shelter check-ins."
          />
        ) : (
          <div className="kpis">
            {kpiRes.data.slice(0, 4).map((k, idx) => {
              const stroke = SPARK_COLORS[idx % SPARK_COLORS.length];
              const fill = SPARK_FILLS[idx % SPARK_FILLS.length];
              return (
                <div key={k.label} className="kpi">
                  <div className="kpi-top">
                    <span className="kpi-lbl">{k.label}</span>
                    <span
                      className={
                        idx === 0
                          ? "tag tag-coral"
                          : idx === 1
                            ? "tag tag-sun"
                            : idx === 2
                              ? "tag tag-ai"
                              : "tag tag-mint"
                      }
                    >
                      Live
                    </span>
                  </div>
                  <div
                    className="kpi-num"
                    style={idx === 2 ? { color: "var(--ai)" } : undefined}
                  >
                    {k.value}
                  </div>
                  <div className="kpi-foot">
                    <span>{k.note}</span>
                    <svg className="spark" viewBox="0 0 76 26">
                      <path
                        d="M2 22 L16 18 L30 19 L44 13 L58 10 L74 4 L74 26 L2 26 Z"
                        fill={fill}
                      />
                      <path
                        d="M2 22 L16 18 L30 19 L44 13 L58 10 L74 4"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3-column status board */}
        {queueRes.error ? (
          <ErrorState message={queueRes.error} />
        ) : queue.length === 0 ? (
          <EmptyState
            title="No assistance requests in queue"
            description="The priority board is currently empty. Newly submitted citizen requests will appear in Needs review, Assigned, and On the way automatically."
          />
        ) : (
          <div className="kb">
            <div className="kb-col">
              <div className="kb-col-h">
                <b>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "999px",
                      background: "var(--coral)",
                    }}
                  />
                  Needs review
                </b>
                <span className="cnt">{colNeedsReview.length}</span>
              </div>
              {colNeedsReview.map((item, idx) => (
                <KanbanCard key={item.id} item={item} highlighted={idx === 0} />
              ))}
            </div>

            <div className="kb-col">
              <div className="kb-col-h">
                <b>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "999px",
                      background: "var(--sun)",
                    }}
                  />
                  Assigned
                </b>
                <span className="cnt">{assigned.length}</span>
              </div>
              {assigned.map((item) => (
                <KanbanCard key={item.id} item={item} />
              ))}
            </div>

            <div className="kb-col">
              <div className="kb-col-h">
                <b>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "999px",
                      background: "var(--mint)",
                    }}
                  />
                  On the way
                </b>
                <span className="cnt">{onTheWay.length}</span>
              </div>
              {onTheWay.map((item) => (
                <KanbanCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Compact map card */}
        <div className="map-card">
          <div className="map-head">
            <div>
              <b style={{ fontSize: "14px" }}>Live map</b>
              <span className="muted" style={{ fontSize: "12px", marginLeft: "8px" }}>
                {queue.length} active requests · {sheltersRes.data.length} shelters
              </span>
            </div>
            <div className="map-legend">
              <span>
                <i className="dot-c" style={{ background: "var(--coral)" }} /> Critical
              </span>
              <span>
                <i className="dot-c" style={{ background: "var(--sun)" }} /> High
              </span>
              <span>
                <i className="dot-c" style={{ background: "var(--mint)" }} /> Shelter
              </span>
            </div>
          </div>
          <div className="map-canvas">
            <svg viewBox="0 0 800 220" preserveAspectRatio="none">
              <rect width="800" height="220" fill="#E6EEF6" />
              <path
                d="M0 150 Q 180 110 340 155 T 680 130 L 800 140 L 800 220 L 0 220 Z"
                fill="#B8DFEC"
                opacity=".7"
              />
              <g stroke="#FFFFFF" strokeWidth="2.5" fill="none" opacity=".9">
                <path d="M0 60 Q 260 90 520 55 T 800 80" />
                <path d="M180 0 L 230 220" />
                <path d="M460 0 L 430 220" />
                <path d="M650 0 L 690 220" />
              </g>
              {sheltersRes.data.slice(0, 6).map((s, idx) => {
                const cx = 140 + ((idx * 115) % 580);
                const cy = 60 + ((idx * 45) % 110);
                return (
                  <g key={s.id}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="8"
                      fill="#2FD6A3"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />
                  </g>
                );
              })}
              {queue.slice(0, 6).map((q, idx) => {
                const cx = 200 + ((idx * 95) % 520);
                const cy = 55 + ((idx * 35) % 120);
                const fill = q.priority === "critical" ? "#FF5A4F" : "#FFC94A";
                return (
                  <g key={q.id}>
                    <circle cx={cx} cy={cy} r="18" fill={fill} opacity=".22" />
                    <circle
                      cx={cx}
                      cy={cy}
                      r="7"
                      fill={fill}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Stock depletion forecast chips */}
        <div className="sub-card" style={{ marginTop: 16 }}>
          <div className="sub-head">
            <h3>Stock Depletion Forecast (EWMA)</h3>
            <Link href="/admin/resources" className="btn btn-ghost btn-sm">Resources &rarr;</Link>
          </div>
          {forecastRes.data.length === 0 ? (
            <div className="muted" style={{ fontSize: 12.5 }}>No resources registered in database.</div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {forecastRes.data.slice(0, 6).map((f) => (
                <span key={f.resourceId} className="tag tag-ai" title={f.explanation}>
                  <b>{f.itemName} ({f.depot}):</b>&nbsp;{f.hasEnoughData ? f.displayText : "not enough data"}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right sticky AI Suggestion drawer */}
      <AiSuggestionPanel recommendation={firstRecommendation} />
    </div>
  );
}
