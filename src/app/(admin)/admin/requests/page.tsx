import Link from "next/link";
import { getQueue, type QueueItem } from "@/lib/api";
import { DataTable, ErrorState, PageHeader, Tag } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DeleteRequestButton } from "./DeleteRequestButton";

export default async function AdminRequestsListPage() {
  const dict = getDictionary("en");
  const { data: rows, error } = await getQueue();

  return (
    <div>
      <PageHeader
        eyebrow="CASE TRIAGE QUEUE"
        eyebrowTone="accent"
        title="Assistance Requests"
        subtitle="Sorted by explainable AI urgency score. Select any case to inspect feature scores and record a human decision."
      />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <DataTable<QueueItem>
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No assistance requests"
          emptyDescription={dict.empty.noQueue}
          columns={[
            {
              key: "id",
              header: "Tracking ID",
              render: (r) => (
                <Link href={`/admin/requests/${r.id}`} className="mono" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
                  {r.id}
                </Link>
              ),
            },
            { key: "need", header: "Category & Description", render: (r) => r.need },
            { key: "area", header: "Area", render: (r) => r.area },
            { key: "wait", header: "Wait Time", render: (r) => <span className="mono">{r.wait}</span> },
            {
              key: "ai",
              header: "AI Score",
              render: (r) => <Tag tone="ai">AI · {r.score}%</Tag>,
            },
            { key: "status", header: "Status", render: (r) => <Tag>{r.status}</Tag> },
            { key: "actions", header: "Actions", render: (r) => <DeleteRequestButton id={r.id} /> },
          ]}
        />
      )}
    </div>
  );
}
