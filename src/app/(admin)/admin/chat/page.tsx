import { getPendingRecommendations, getQueue } from "@/lib/api";
import { ChatInboxClient } from "./ChatInboxClient";

export default async function AdminChatPage() {
  const [{ data: queue }, { data: recommendations }] = await Promise.all([
    getQueue(),
    getPendingRecommendations(),
  ]);

  return <ChatInboxClient cases={queue} recommendations={recommendations} />;
}
