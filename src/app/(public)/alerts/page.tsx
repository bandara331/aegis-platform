import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

interface PublicAlert {
  id: string;
  title: string;
  message: string;
  district: string;
  severity: string;
  language: string;
  issuedAtUtc: string;
  expiresAtUtc?: string | null;
}

interface AutomatedPublicAlert {
  id: string;
  district: string;
  triggeredLevel: string;
  alertKind: string;
  dataSource: string;
  dataTimestampUtc: string;
  modelUsed: string;
  messageEn: string;
  messageSi: string;
  messageTa: string;
  sentAtUtc?: string | null;
  createdAt: string;
}

export default async function PublicAlertsPage() {
  const dict = getDictionary("en");
  let alerts: PublicAlert[] = [];
  let automated: AutomatedPublicAlert[] = [];

  try {
    const [officialRes, autoRes] = await Promise.all([
      fetch(`${API_BASE_URL}/alerts?activeOnly=true`, { cache: "no-store" }),
      fetch(`${API_BASE_URL}/alerts/automated`, { cache: "no-store" }),
    ]);
    if (officialRes.ok) {
      const data = await officialRes.json();
      alerts = Array.isArray(data) ? data : [];
    }
    if (autoRes.ok) {
      const autoData = await autoRes.json();
      automated = Array.isArray(autoData) ? autoData : [];
    }
  } catch {
    alerts = [];
    automated = [];
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 16 }}>
      <PageHeader
        eyebrow="PUBLIC ALERTS & ADVISORIES"
        eyebrowTone="warning"
        title="Active Crisis Advisories & Warnings"
        subtitle="Official bulletins from Emergency Coordinators and automated weather advisories from Open-Meteo data."
      />

      {alerts.length === 0 && automated.length === 0 ? (
        <EmptyState title="No active public alerts" description={dict.empty.noAlerts} />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {alerts.map((a) => (
            <Card key={a.id}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <Tag tone={a.severity === "Critical" ? "critical" : a.severity === "Warning" ? "warning" : "accent"}>
                  {a.severity.toUpperCase()}
                </Tag>
                <Tag tone="success">OFFICIAL ALERT</Tag>
                <Tag>{a.district}</Tag>
                <Tag>{a.language.toUpperCase()}</Tag>
              </div>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>{a.title}</h2>
              <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.5 }}>{a.message}</p>
              <div className="mono muted" style={{ fontSize: 11.5 }}>
                Issued {new Date(a.issuedAtUtc).toUTCString()}
              </div>
            </Card>
          ))}

          {automated.map((a) => {
            const isAiText = a.modelUsed && a.modelUsed !== "template";
            return (
              <Card
                key={a.id}
                style={{
                  borderLeft: "4px solid var(--violet)",
                  background: "rgba(255, 255, 255, 0.9)",
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <Tag tone="ai">AUTOMATED ADVISORY</Tag>
                  <Tag tone={a.triggeredLevel === "Severe" ? "critical" : a.triggeredLevel === "High" ? "warning" : "success"}>
                    {a.triggeredLevel.toUpperCase()}
                  </Tag>
                  <Tag>{a.district}</Tag>
                  <Tag>{a.dataSource}</Tag>
                </div>
                <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700 }}>
                  {a.district} — {a.alertKind === "RiskReduced" ? "Weather risk reduced" : `${a.triggeredLevel} weather advisory`}
                </h2>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: isAiText ? "#5b21b6" : "var(--ink)",
                  }}
                >
                  {a.messageEn}
                </p>
                <div className="mono muted" style={{ fontSize: 11.5 }}>
                  Data observed {new Date(a.dataTimestampUtc).toUTCString()} · Wording: {a.modelUsed}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
