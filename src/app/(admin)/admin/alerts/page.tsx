import { EmptyState, PageHeader } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function AdminAlertsPage() {
  const dict = getDictionary("en");

  return (
    <div>
      <PageHeader
        eyebrow="EMERGENCY BROADCASTS"
        eyebrowTone="warning"
        title="Official Alerts Management"
        subtitle="Publish and manage multilingual crisis advisories for affected districts."
      />
      <EmptyState
        title="No official alerts published"
        description={dict.empty.noAlerts}
      />
    </div>
  );
}
