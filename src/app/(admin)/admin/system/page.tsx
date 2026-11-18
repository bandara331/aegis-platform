import { cookies } from "next/headers";
import { Card, ErrorState, PageHeader, Tag } from "@/components/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

interface HealthItem {
  serviceName: string;
  status: string;
  details: string;
  lastCheckedAt: string;
}

interface AiOverview {
  triageProvider: string;
  triageVersion: string;
  promptVersion: string;
  assistantProvider: string;
  assistantModel: string;
  keyConfigured: boolean;
  recommendationsGenerated: number;
  humanDecisionsRecorded: number;
}

export default async function AdminSystemHealthPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("aegis_token")?.value;

  let services: HealthItem[] = [];
  let overallStatus = "Unknown";
  let ai: AiOverview | null = null;
  let error: string | null = null;

  try {
    const [healthRes, sysRes] = await Promise.all([
      fetch(`${API_BASE_URL}/health`, { cache: "no-store" }),
      token
        ? fetch(`${API_BASE_URL}/system/overview`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          })
        : Promise.resolve(null),
    ]);

    if (healthRes.ok) {
      const data = await healthRes.json();
      overallStatus = data.overallStatus || "Healthy";
      services = Array.isArray(data.services) ? data.services : [];
    } else {
      error = `Health check returned HTTP ${healthRes.status}`;
    }

    if (sysRes && sysRes.ok) {
      const sysData = await sysRes.json();
      ai = sysData.ai ?? null;
    }
  } catch {
    error = "Unable to connect to AEGIS backend health endpoint.";
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow={`OVERALL STATUS · ${overallStatus.toUpperCase()}`}
        eyebrowTone={overallStatus === "Healthy" ? "success" : "warning"}
        title="System Health & AI Settings"
        subtitle="Real-time status across Database, AI Engine, Email (SMTP), Maps/Routing, Realtime, and External Data Feeds. API keys are never exposed."
      />

      {ai && (
        <Card aiHighlight>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <Tag tone="ai">AI CONFIGURATION &amp; USAGE</Tag>
              <h2 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 700 }}>Active Providers &amp; Prompt Governance</h2>
            </div>
            <Tag tone={ai.keyConfigured ? "success" : "warning"}>
              {ai.keyConfigured ? "Assistant key stored in user-secrets" : "Assistant key not configured"}
            </Tag>
          </div>
          <div className="bento-grid cols-2">
            <div className="kv"><span>Triage Engine</span><b className="mono">{ai.triageProvider} v{ai.triageVersion}</b></div>
            <div className="kv"><span>Prompt Version</span><b className="mono">{ai.promptVersion}</b></div>
            <div className="kv"><span>Assistant Provider</span><b className="mono">{ai.assistantProvider}</b></div>
            <div className="kv"><span>Assistant Model</span><b className="mono">{ai.assistantModel}</b></div>
            <div className="kv"><span>AI Recommendations Logged</span><b className="mono">{ai.recommendationsGenerated}</b></div>
            <div className="kv"><span>Human Decisions Recorded</span><b className="mono">{ai.humanDecisionsRecorded}</b></div>
          </div>
        </Card>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : (
        <div className="bento-grid cols-2">
          {services.map((s) => {
            const tone =
              s.status === "Healthy"
                ? "success"
                : s.status === "Degraded"
                  ? "warning"
                  : "critical";
            return (
              <Card key={s.serviceName}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <strong className="mono" style={{ fontSize: "16px" }}>{s.serviceName}</strong>
                  <Tag tone={tone} pulse={s.status === "Healthy"}>
                    {s.status.toUpperCase()}
                  </Tag>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: "14px", color: "var(--muted)" }}>
                  {s.details}
                </p>
                <div className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Checked: {new Date(s.lastCheckedAt).toUTCString()}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
