import Link from "next/link";
import { getRequests } from "@/lib/api";
import { EmptyState, ErrorState } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

function humanStatus(raw: string): { label: string; tagClass: string } {
  const s = raw.toLowerCase();
  if (s === "submitted" || s === "new") return { label: "New", tagClass: "tag tag-teal" };
  if (s === "needsreview" || s === "manualtriage" || s === "duplicatecheck" || s === "under review") {
    return { label: "Under review", tagClass: "tag tag-sun" };
  }
  if (s === "approved") return { label: "Approved", tagClass: "tag tag-mint" };
  if (s === "assigned") return { label: "Assigned", tagClass: "tag tag-teal" };
  if (s === "dispatched" || s === "on the way") return { label: "On the way", tagClass: "tag tag-mint" };
  if (s === "fulfilled" || s === "closed" || s === "completed") {
    return { label: "Completed", tagClass: "tag tag-mint" };
  }
  if (s === "rejected") return { label: "Rejected", tagClass: "tag tag-coral" };
  if (s === "cancelled") return { label: "Cancelled", tagClass: "tag tag-muted" };
  return { label: raw, tagClass: "tag tag-muted" };
}

export default async function CitizenMyRequestsPage() {
  const dict = getDictionary("en");
  const { data: rows, error } = await getRequests();

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="eyebrow" style={{ color: "var(--teal)" }}>
            MY ASSISTANCE REQUESTS
          </span>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "4px 0 0" }}>
            Submitted cases
          </h1>
        </div>
        <Link href="/request" className="btn btn-teal btn-sm" style={{ textDecoration: "none" }}>
          + New request
        </Link>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No submitted requests"
          description={dict.empty.noRequests}
          action={
            <Link href="/request" className="btn btn-teal btn-sm" style={{ textDecoration: "none" }}>
              Request emergency aid
            </Link>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {rows.map((r) => {
            const st = humanStatus(r.status);
            return (
              <Link
                key={r.id}
                href={`/my-requests/${r.id}`}
                className="card"
                style={{
                  borderRadius: "22px",
                  padding: "18px",
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: "12.5px", color: "var(--teal)" }}>
                    {r.trackingNumber}
                  </span>
                  <span className={st.tagClass}>{st.label}</span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                  {r.category} · {r.area}
                </div>
                <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                  {r.description}
                </p>
                {r.rejectionReason && (
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "10px",
                      background: "var(--coral-tint)",
                      fontSize: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <b>Staff reason:</b> {r.rejectionReason}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)" }}>
                  <span>{r.peopleCount} {r.peopleCount === 1 ? "person" : "people"}</span>
                  <span>View timeline &amp; details →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
