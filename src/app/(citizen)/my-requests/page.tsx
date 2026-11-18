import Link from "next/link";
import { getRequests } from "@/lib/api";
import { EmptyState, ErrorState } from "@/components/ui";
import { Icon } from "@/components/icons/Icon";
import { getDictionary } from "@/lib/i18n/dictionary";

const PIPELINE_STEPS = ["Submitted", "Under review", "Approved", "On the way", "Completed"];

function humanStatus(raw: string): { label: string; tagClass: string; stageIndex: number } {
  const s = raw.toLowerCase();
  if (s === "submitted" || s === "new") return { label: "New", tagClass: "tag tag-teal", stageIndex: 0 };
  if (s === "needsreview" || s === "manualtriage" || s === "duplicatecheck" || s === "under review") {
    return { label: "Under review", tagClass: "tag tag-sun", stageIndex: 1 };
  }
  if (s === "approved" || s === "assigned") return { label: "Approved", tagClass: "tag tag-mint", stageIndex: 2 };
  if (s === "dispatched" || s === "on the way" || s === "intransit") {
    return { label: "On the way", tagClass: "tag tag-mint", stageIndex: 3 };
  }
  if (s === "fulfilled" || s === "closed" || s === "completed") {
    return { label: "Completed", tagClass: "tag tag-mint", stageIndex: 4 };
  }
  if (s === "rejected") return { label: "Rejected", tagClass: "tag tag-coral", stageIndex: -1 };
  if (s === "cancelled") return { label: "Cancelled", tagClass: "tag tag-muted", stageIndex: -1 };
  return { label: raw, tagClass: "tag tag-muted", stageIndex: 0 };
}

export default async function CitizenMyRequestsPage() {
  const dict = getDictionary("en");
  const { data: rows, error } = await getRequests();

  const totalCount = rows.length;
  const reviewCount = rows.filter((r) => {
    const idx = humanStatus(r.status).stageIndex;
    return idx === 0 || idx === 1;
  }).length;
  const dispatchCount = rows.filter((r) => {
    const idx = humanStatus(r.status).stageIndex;
    return idx === 2 || idx === 3;
  }).length;
  const completedCount = rows.filter((r) => humanStatus(r.status).stageIndex === 4).length;

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {/* Deep Forest Citizen Command Hero */}
      <section className="cit-hero-banner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#B9E29A" }}>
              ● CITIZEN ASSISTANCE DASHBOARD
            </span>
            <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 4px", color: "#fff", textShadow: "none" }}>
              Submitted cases
            </h1>
            <p style={{ margin: 0, fontSize: "13.5px", color: "#C5D8D0" }}>
              Follow live coordinator review, resource dispatch, and direct two-way updates.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/request" className="btn btn-coral btn-sm" style={{ textDecoration: "none" }}>
              <Icon name="plus" size={14} /> New request
            </Link>
            <Link href="/chat" className="btn btn-teal btn-sm" style={{ textDecoration: "none" }}>
              <Icon name="chat" size={14} /> Live chat
            </Link>
            <Link href="/assistant" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
              <Icon name="spark" size={14} /> AI assistant
            </Link>
          </div>
        </div>

        <div className="cit-metrics-row">
          <div className="cit-metric-card">
            <span className="mono">TOTAL SUBMITTED</span>
            <b>{totalCount}</b>
          </div>
          <div className="cit-metric-card">
            <span className="mono">UNDER REVIEW</span>
            <b style={{ color: "#FFC94A" }}>{reviewCount}</b>
          </div>
          <div className="cit-metric-card">
            <span className="mono">APPROVED / DISPATCHED</span>
            <b style={{ color: "#B9E29A" }}>{dispatchCount}</b>
          </div>
          <div className="cit-metric-card">
            <span className="mono">COMPLETED</span>
            <b style={{ color: "#8BE8B5" }}>{completedCount}</b>
          </div>
        </div>
      </section>

      {error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No submitted requests"
          description={dict.empty.noRequests}
          action={
            <Link href="/request" className="btn btn-coral btn-sm" style={{ textDecoration: "none" }}>
              Request emergency aid
            </Link>
          }
        />
      ) : (
        <div className="cit-cases-grid">
          {rows.map((r) => {
            const st = humanStatus(r.status);
            return (
              <Link
                key={r.id}
                href={`/my-requests/${r.id}`}
                className="card"
                style={{
                  borderRadius: "24px",
                  padding: "22px",
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", gap: 8 }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: "12.5px", color: "var(--teal)" }}>
                    {r.trackingNumber}
                  </span>
                  <span className={st.tagClass}>{st.label}</span>
                </div>
                <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "6px" }}>
                  {r.category} · {r.area}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                  {r.description}
                </p>

                {st.stageIndex >= 0 && (
                  <div className="cit-pipeline" aria-label="Case stage progress">
                    {PIPELINE_STEPS.map((label, idx) => {
                      const done = idx <= st.stageIndex;
                      const current = idx === st.stageIndex;
                      return (
                        <div key={label} className={`cit-pipe-step ${done ? "done" : ""} ${current ? "current" : ""}`.trim()}>
                          <div className="cit-pipe-bar" />
                          <span>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {r.rejectionReason && (
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "10px",
                      background: "#FFE7E4",
                      color: "#9F1E16",
                      fontSize: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <b>Staff reason:</b> {r.rejectionReason}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)" }}>
                  <span>{r.peopleCount} {r.peopleCount === 1 ? "person" : "people"}</span>
                  <span style={{ fontWeight: 700, color: "var(--teal)" }}>View timeline &amp; details →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
