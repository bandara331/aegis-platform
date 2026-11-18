import { getRequests } from "@/lib/api";
import { ErrorState, PageHeader } from "@/components/ui";
import { CitizenChatClient } from "./CitizenChatClient";

export default async function CitizenChatPage() {
  const { data: requests, error } = await getRequests();

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <PageHeader
        eyebrow="DIRECT COORDINATOR CHAT"
        eyebrowTone="accent"
        title="Chat with relief staff"
        subtitle="Messages are delivered directly to the AEGIS coordinator inbox and linked to your request."
      />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <CitizenChatClient requests={requests} />
      )}
    </div>
  );
}
