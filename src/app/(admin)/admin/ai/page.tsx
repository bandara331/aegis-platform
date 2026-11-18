import { getAiAnalytics, getAiGovernance } from "@/lib/api";
import AiGovernanceClient from "./AiGovernanceClient";

export const dynamic = "force-dynamic";

export default async function AdminAiGovernancePage() {
  const [govRes, analyticsRes] = await Promise.all([
    getAiGovernance(),
    getAiAnalytics(),
  ]);

  return (
    <AiGovernanceClient
      initialGovernance={govRes.data}
      initialAnalytics={analyticsRes.data}
      initialError={govRes.error || analyticsRes.error}
    />
  );
}
