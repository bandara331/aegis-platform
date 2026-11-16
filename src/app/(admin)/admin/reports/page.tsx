import { EmptyState, PageHeader } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function AdminReportsPage() {
  const dict = getDictionary("en");

  return (
    <div>
      <PageHeader
        eyebrow="POST-INCIDENT REVIEW"
        eyebrowTone="accent"
        title="Analytical & Accountability Reports"
        subtitle="Replayable decision summaries and AI override reports generated from real database records."
      />
      <EmptyState
        title="No analytical reports available"
        description={dict.empty.noReports}
      />
    </div>
  );
}
