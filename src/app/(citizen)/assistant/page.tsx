import { cookies } from "next/headers";
import { Card, PageHeader, Tag } from "@/components/ui";
import { AiAssistantBox } from "@/components/chat/AiAssistantBox";

export default async function CitizenAssistantPage() {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get("aegis_token")?.value);

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <PageHeader
        eyebrow="AI PREPAREDNESS & TRIAGE ASSISTANT"
        eyebrowTone="ai"
        title="Multilingual AI Guidance"
        subtitle="Guidance in English, Sinhala, and Tamil. AI output is highlighted in violet and never alters your official request status without human coordinator approval."
      />

      <Card aiHighlight>
        <div style={{ marginBottom: "8px" }}>
          <Tag tone="ai">AI OUTPUT NOTICE</Tag>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: "13px", color: "var(--muted)" }}>
          Personal NIC numbers are never sent to the AI assistant. All life-safety dispatches are decided by named human coordinators.
        </p>
        <AiAssistantBox isLoggedIn={isLoggedIn} />
      </Card>
    </div>
  );
}
