import Link from "next/link";
import { getPublicStats } from "@/lib/api";
import { Button, Card, StatCard, Tag } from "@/components/ui";

export default async function PublicHomePage() {
  const { data: stats } = await getPublicStats();

  const liveMetrics = stats
    ? [
        { label: "Resolved requests", value: stats.resolvedRequestsCount, note: "Verified closed" },
        { label: "Active crises", value: stats.activeCrisesCount, note: "Live response" },
        { label: "Open shelters", value: stats.openSheltersCount, note: "Registered" },
        { label: "People sheltered", value: stats.shelteredPeopleCount, note: "Current occupancy" },
      ].filter((m) => m.value > 0)
    : [];

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <Card style={{ padding: "40px 32px" }}>
        <div style={{ marginBottom: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Tag tone="accent" pulse>
            HUMANITARIAN COORDINATION PLATFORM
          </Tag>
          <Tag tone="ai">AI-ASSISTED TRIAGE</Tag>
        </div>
        <h1
          style={{
            margin: "0 0 14px",
            fontSize: "clamp(32px, 4.5vw, 52px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            color: "var(--ink)",
            maxWidth: "780px",
          }}
        >
          Every emergency request seen, verified, dispatched, and cryptographically audited.
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: "16px", color: "var(--muted)", maxWidth: "660px" }}>
          One shared operational picture where citizens report needs in English, Sinhala, or Tamil, AI scores urgency and explains its reasoning, and named human coordinators make every critical decision.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/register" style={{ textDecoration: "none" }}>
            <Button variant="primary">Request Emergency Aid</Button>
          </Link>
          <Link href="/alerts" style={{ textDecoration: "none" }}>
            <Button variant="secondary">View Public Alerts</Button>
          </Link>
          <Link href="/staff/login" style={{ textDecoration: "none" }}>
            <Button variant="ghost">Staff Operations Sign-In →</Button>
          </Link>
        </div>
      </Card>

      {/* Public aggregates from GET /api/v1/public/stats — hidden when zero */}
      {liveMetrics.length > 0 && (
        <section aria-label="Live public statistics" className="bento-grid cols-4">
          {liveMetrics.map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} note={m.note} tone="success" />
          ))}
        </section>
      )}

      <section className="bento-grid cols-3">
        <Card interactive>
          <Tag tone="accent">01 · PRIVACY &amp; IDENTITY</Tag>
          <h2 style={{ margin: "14px 0 8px", fontSize: "20px", fontWeight: 700 }}>
            AES-256-GCM Encrypted NIC
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>
            Citizen National Identity Card numbers are encrypted at rest, indexed via HMAC-SHA256 for deduplication, masked on screen, and never transmitted to any AI provider.
          </p>
        </Card>

        <Card interactive aiHighlight>
          <Tag tone="ai">02 · AI ADVISORY OUTPUT</Tag>
          <h2 style={{ margin: "14px 0 8px", fontSize: "20px", fontWeight: 700 }}>
            Explainable Triage Scoring
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>
            Multilingual heuristics evaluate urgency, household vulnerability, waiting time, and depot distance. AI never mutates state on its own—only a human decision changes a case.
          </p>
        </Card>

        <Card interactive>
          <Tag tone="success">03 · TAMPER-EVIDENT AUDIT</Tag>
          <h2 style={{ margin: "14px 0 8px", fontSize: "20px", fontWeight: 700 }}>
            Two-Person Rule &amp; Hash Chain
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>
            Critical medical dispatches and role changes require a second authorised approver. Every action is sealed in an append-only SHA-256 hash chain guarded by PostgreSQL triggers.
          </p>
        </Card>
      </section>
    </div>
  );
}
