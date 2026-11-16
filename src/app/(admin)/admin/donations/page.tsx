import { EmptyState, PageHeader } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function AdminDonationsPage() {
  const dict = getDictionary("en");

  return (
    <div>
      <PageHeader
        eyebrow="DONOR OVERSIGHT & ANOMALY DETECTION"
        eyebrowTone="accent"
        title="Campaigns & Donations"
        subtitle="Track humanitarian relief campaigns and review donations flagged for statistical z-score or rapid-repeat anomalies."
      />
      <EmptyState
        title="No campaigns or donations"
        description={dict.empty.noDonations}
      />
    </div>
  );
}
