import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export default function CitizenAssistantPage() {
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
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
          Personal NIC numbers are never sent to the AI assistant. All life-safety dispatches are decided by named human coordinators.
        </p>
      </Card>

      <EmptyState
        title="No active AI conversation"
        description="Start a conversation when an active crisis advisory is in effect to receive multilingual preparedness checklists."
      />
    </div>
  );
}
