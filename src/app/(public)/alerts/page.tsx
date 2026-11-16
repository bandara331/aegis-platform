import { EmptyState, PageHeader } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function PublicAlertsPage() {
  const dict = getDictionary("en");

  return (
    <div>
      <PageHeader
        eyebrow="PUBLIC OFFICIAL ALERTS"
        eyebrowTone="warning"
        title="Active Crisis Advisories & Warnings"
        subtitle="Verified bulletins and evacuation notices issued by Emergency Coordinators."
      />
      <EmptyState
        title="No active public alerts"
        description={dict.empty.noAlerts}
      />
    </div>
  );
}
