import { EmptyState, PageHeader } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function AdminVolunteersPage() {
  const dict = getDictionary("en");

  return (
    <div>
      <PageHeader
        eyebrow="VOLUNTEER COORDINATION"
        eyebrowTone="accent"
        title="Volunteer Registry & Skill Matching"
        subtitle="Match verified field volunteers to active requests by skill overlap, availability, and route distance."
      />
      <EmptyState
        title="No volunteers registered"
        description={dict.empty.noVolunteers}
      />
    </div>
  );
}
