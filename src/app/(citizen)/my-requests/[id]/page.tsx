import Link from "next/link";
import { getRequestById } from "@/lib/api";
import { Button, Card, EmptyState, ErrorState } from "@/components/ui";
import { CaseTabs } from "./CaseTabs";
import { CitizenRequestActions } from "./CitizenRequestActions";
import { LiveRequestChat } from "@/components/chat/LiveRequestChat";

function formatBadge(rawStatus: string): { label: string; className: string } {
  const s = rawStatus.toLowerCase();
  if (s === "submitted" || s === "new") return { label: "New", className: "tag tag-teal" };
  if (s === "needsreview" || s === "manualtriage" || s === "duplicatecheck" || s === "under review") {
    return { label: "Under review", className: "tag tag-sun" };
  }
  if (s === "approved") return { label: "Approved", className: "tag tag-mint" };
  if (s === "assigned") return { label: "Assigned", className: "tag tag-teal" };
  if (s === "dispatched" || s === "on the way") return { label: "On the way", className: "tag tag-mint" };
  if (s === "fulfilled" || s === "closed" || s === "completed") {
    return { label: "Completed", className: "tag tag-mint" };
  }
  if (s === "rejected") return { label: "Rejected", className: "tag tag-coral" };
  if (s === "cancelled") return { label: "Cancelled", className: "tag tag-muted" };
  return { label: rawStatus, className: "tag tag-muted" };
}

export default async function CitizenRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: req, error } = await getRequestById(id);

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!req) {
    return (
      <EmptyState
        title="Request not found"
        description="This request does not exist, or it does not belong to your account."
        action={
          <Link href="/my-requests" style={{ textDecoration: "none" }}>
            <Button variant="secondary">← My requests</Button>
          </Link>
        }
      />
    );
  }

  const badge = formatBadge(req.status);
  const timeline = req.timeline ?? [];
  const evidence = req.evidence ?? [];

  const statusPane = (
    <div style={{ display: "grid", gap: "14px" }}>
      {/* Staff rejection reason banner when rejected */}
      {req.status.toLowerCase() === "rejected" && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "18px",
            background: "var(--coral-tint)",
            border: "1.5px solid var(--coral)",
          }}
        >
          <b style={{ display: "block", fontSize: "13px", marginBottom: "4px" }}>
            Request rejected by coordinator
          </b>
          <span style={{ fontSize: "13px", color: "var(--ink)" }}>
            Reason: {req.rejectionReason || "Not specified by coordinator."}
          </span>
        </div>
      )}

      {/* Status Timeline (New, Under review, Approved, Assigned, On the way, Completed / Rejected) */}
      <Card style={{ padding: "18px 20px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "12px" }}>
          Status timeline
        </div>
        <div className="tl">
          {timeline.map((step) => {
            const dotColor =
              step.stage === "Rejected"
                ? "var(--coral)"
                : step.current
                  ? "var(--teal)"
                  : step.completed
                    ? "var(--mint)"
                    : "var(--line-strong)";

            return (
              <div
                key={step.stage}
                className="tl-item"
                style={{ opacity: step.completed || step.current ? 1 : 0.55 }}
              >
                <span className="tl-dot" style={{ background: dotColor }} />
                <div>
                  <b style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {step.stage}
                    {step.current && (
                      <span className="tag tag-teal" style={{ padding: "1px 7px", fontSize: "10px" }}>
                        Current
                      </span>
                    )}
                  </b>
                  <span>{step.notes}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Request details KV card */}
      <Card style={{ padding: "8px 20px" }}>
        <div className="kv">
          <span>Reference</span>
          <b className="mono">{req.trackingNumber}</b>
        </div>
        <div className="kv">
          <span>Status</span>
          <b>{badge.label}</b>
        </div>
        <div className="kv">
          <span>Category</span>
          <b>{req.category}</b>
        </div>
        <div className="kv">
          <span>Location</span>
          <b>{req.area}</b>
        </div>
        <div className="kv">
          <span>People</span>
          <b>{req.peopleCount}</b>
        </div>
        {req.vulnerableFlags && (
          <div className="kv">
            <span>Vulnerability flags</span>
            <b>{req.vulnerableFlags}</b>
          </div>
        )}
        {req.contactEmail && (
          <div className="kv">
            <span>Email updates</span>
            <b>{req.contactEmail}</b>
          </div>
        )}
        <div className="kv">
          <span>Submitted</span>
          <b>{new Date(req.createdAt).toLocaleString()}</b>
        </div>
      </Card>

      {/* Evidence files if attached */}
      {evidence.length > 0 && (
        <Card style={{ padding: "14px 18px" }}>
          <b style={{ fontSize: "13px", display: "block", marginBottom: "8px" }}>
            Attached evidence ({evidence.length})
          </b>
          <div style={{ display: "grid", gap: "6px" }}>
            {evidence.map((ev) => (
              <div
                key={ev.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  padding: "6px 10px",
                  borderRadius: "10px",
                  background: "var(--surface-soft)",
                }}
              >
                <span>{ev.fileName}</span>
                <span className="mono muted">{Math.round(ev.fileSizeBytes / 1024)} KB</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cancel while allowed & Feedback after completion */}
      <CitizenRequestActions
        requestId={req.id}
        canCancel={Boolean(req.canCancel)}
        canSubmitFeedback={Boolean(req.canSubmitFeedback)}
        existingRating={req.feedbackRating}
        existingComment={req.feedbackComment}
      />
    </div>
  );

  const chatPane = (
    <div style={{ marginTop: 12 }}>
      <LiveRequestChat
        requestId={req.id}
        trackingNumber={req.trackingNumber}
        viewerRole="Citizen"
        height={380}
      />
    </div>
  );

  return (
    <div>
      <Link
        href="/my-requests"
        style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}
      >
        ← My requests
      </Link>
      <div style={{ margin: "10px 0 4px" }} className="mono">
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          REFERENCE · {req.trackingNumber}
        </span>
      </div>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-.02em",
          margin: "0 0 8px",
        }}
      >
        {req.category}: {req.description}
      </h1>
      <span className={badge.className}>{badge.label}</span>
      <CaseTabs status={statusPane} chat={chatPane} />
    </div>
  );
}
