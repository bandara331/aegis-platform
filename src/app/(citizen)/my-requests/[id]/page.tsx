import Link from "next/link";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function CitizenRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dict = getDictionary("en");

  return (
    <div>
      <PageHeader
        eyebrow={`CASE DETAIL · ${id.slice(0, 8)}`}
        eyebrowTone="accent"
        title="Case Status & Coordinator Chat"
        subtitle="Real-time status updates and direct two-way communication with your assigned Case Manager."
        actions={
          <Link href="/my-requests" style={{ textDecoration: "none" }}>
            <Button variant="secondary">← Back</Button>
          </Link>
        }
      />

      <EmptyState
        title="No coordinator messages yet"
        description={dict.empty.noMessages}
      />
    </div>
  );
}
