import { cookies } from "next/headers";
import Link from "next/link";
import { Card, PageHeader, Tag } from "@/components/ui";
import { Icon } from "@/components/icons/Icon";
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

      <div className="cit-ai-studio">
        {/* Left AI Preparedness Notice & Guardrails Sidebar */}
        <Card aiHighlight style={{ display: "grid", gap: 14 }}>
          <div>
            <Tag tone="ai">AI OUTPUT NOTICE</Tag>
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Advisory Preparedness Companion
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
            Personal NIC numbers are never sent to the AI assistant. All life-safety dispatches are decided and signed by named human coordinators.
          </p>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: 16,
              background: "var(--violet-tint)",
              border: "1px solid rgba(124, 58, 237, 0.22)",
              display: "grid",
              gap: 8,
              fontSize: 12.5,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--violet)" }}>
              <Icon name="sparkle" size={14} /> Trilingual Safety Guidance
            </div>
            <span className="muted">• Flood evacuation checklists &amp; clean water safety</span>
            <span className="muted">• Medical cold-chain tips during power cuts</span>
            <span className="muted">• Clear walkthroughs in English, සිංහල, and தமிழ்</span>
          </div>

          <Link href="/request" className="btn btn-coral btn-sm" style={{ textDecoration: "none", justifySelf: "start" }}>
            Need urgent human aid? Submit request →
          </Link>
        </Card>

        {/* Right Full-Width AI Conversation Panel */}
        <Card aiHighlight style={{ padding: 22 }}>
          <AiAssistantBox isLoggedIn={isLoggedIn} />
        </Card>
      </div>
    </div>
  );
}
