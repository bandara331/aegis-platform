import Link from "next/link";
import { getPendingRecommendations } from "@/lib/api";
import { Button, Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: recs } = await getPendingRecommendations();
  const match = recs.find((r) => r.requestTrackingNumber === id || r.requestId === id || r.id === id);

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow={`CASE INSPECTION · ${id}`}
        eyebrowTone="accent"
        title={`Case ${id}`}
        subtitle="Human-in-the-loop governance: AI advises, named humans decide, critical medical actions require a second approver."
        actions={
          <Link href="/admin/requests" style={{ textDecoration: "none" }}>
            <Button variant="secondary">← Back to Queue</Button>
          </Link>
        }
      />

      {!match ? (
        <EmptyState
          title="No pending AI recommendation for this case"
          description="Either this case has already been decided by a coordinator or no recommendation record exists in the database."
        />
      ) : (
        <Card aiHighlight>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <Tag tone="ai">AI ADVISORY · {match.modelName} v{match.modelVersion}</Tag>
            <span className="mono" style={{ fontWeight: 700, color: "var(--ai-violet)" }}>
              Confidence {Math.round(match.confidence * 100)}%
            </span>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: "14px", color: "var(--ink)" }}>
            Priority: <strong>{match.priority}</strong> · Status: <strong>{match.status}</strong>
          </p>
          <pre className="mono" style={{ margin: 0, padding: "12px", borderRadius: "12px", background: "var(--bg-subtle)", fontSize: "12px", overflowX: "auto" }}>
            {match.featureScoresJson}
          </pre>
        </Card>
      )}
    </div>
  );
}
