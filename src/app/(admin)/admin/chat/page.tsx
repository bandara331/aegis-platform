import { EmptyState, PageHeader } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

export default function AdminChatPage() {
  const dict = getDictionary("en");

  return (
    <div>
      <PageHeader
        eyebrow="FIELD COMMUNICATIONS"
        eyebrowTone="accent"
        title="Coordinator & Citizen Threads"
        subtitle="Direct multilingual communication channels linked to active assistance requests."
      />
      <EmptyState
        title="No active communication threads"
        description={dict.empty.noMessages}
      />
    </div>
  );
}
