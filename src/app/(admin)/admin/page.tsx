import Link from "next/link";
import { getKpis, getQueue } from "@/lib/api";
import { Button, DataTable, ErrorState, PageHeader, StatCard, Tag } from "@/components/ui";
import type { QueueItem } from "@/lib/api";

export default async function AdminOverviewPage() {
  const [kpiRes, queueRes] = await Promise.all([getKpis(), getQueue()]);

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <PageHeader
        eyebrow="COMMAND OVERVIEW"
        eyebrowTone="accent"
        title="Humanitarian Operations Center"
        subtitle="Live operational metrics and AI-scored priority queue from PostgreSQL."
        actions={
          <Link href="/admin/system" style={{ textDecoration: "none" }}>
            <Button variant="secondary">System Health</Button>
          </Link>
        }
      />

      {kpiRes.error ? (
        <ErrorState message={kpiRes.error} />
      ) : (
        <section className="bento-grid cols-4" aria-label="Operational KPIs">
          {kpiRes.data.map((k) => (
            <StatCard key={k.label} label={k.label} value={k.value} note={k.note} tone="accent" />
          ))}
        </section>
      )}

      <section>
        {queueRes.error ? (
          <ErrorState message={queueRes.error} />
        ) : (
          <DataTable<QueueItem>
            rows={queueRes.data}
            rowKey={(r) => r.id}
            emptyTitle="No assistance requests in queue"
            emptyDescription="The priority queue is currently empty. Newly submitted citizen requests will appear here automatically."
            columns={[
              {
                key: "id",
                header: "Case ID",
                render: (r) => (
                  <Link href={`/admin/requests/${r.id}`} className="mono" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
                    {r.id}
                  </Link>
                ),
              },
              { key: "need", header: "Need & Description", render: (r) => r.need },
              { key: "area", header: "District / Area", render: (r) => r.area },
              { key: "wait", header: "Waiting", render: (r) => <span className="mono">{r.wait}</span> },
              {
                key: "priority",
                header: "AI Advisory Score",
                render: (r) => (
                  <Tag tone="ai">
                    AI · {r.priority.toUpperCase()} ({r.score}%)
                  </Tag>
                ),
              },
              { key: "status", header: "Status", render: (r) => <Tag>{r.status}</Tag> },
            ]}
          />
        )}
      </section>
    </div>
  );
}
