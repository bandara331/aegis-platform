import { EmptyState, PageHeader } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function AdminResourcesPage() {
  const dict = getDictionary("en");

  return (
    <div>
      <PageHeader
        eyebrow="LOGISTICS & SCARCITY SIMULATION"
        eyebrowTone="accent"
        title="Relief Resources & Depots"
        subtitle="Manage depot stock with concurrency-safe allocation and run MaxUrgency, FairShare, or FastestEta shortage simulations."
      />
      <EmptyState
        title="No relief resources registered"
        description={dict.empty.noResources}
      />
    </div>
  );
}
