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

export default async function PublicAlertsPage() {
  const dict = getDictionary("en");
  let alerts: PublicAlert[] = [];

  try {
    const res = await fetch(`${API_BASE_URL}/alerts?activeOnly=true`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      alerts = Array.isArray(data) ? data : [];
    }
  } catch {
    alerts = [];
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 16 }}>
      <PageHeader
        eyebrow="PUBLIC OFFICIAL ALERTS"
        eyebrowTone="warning"
        title="Active Crisis Advisories & Warnings"
        subtitle="Verified bulletins and evacuation notices issued by Emergency Coordinators."
      />

      {alerts.length === 0 ? (
        <EmptyState title="No active public alerts" description={dict.empty.noAlerts} />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {alerts.map((a) => (
            <Card key={a.id}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <Tag tone={a.severity === "Critical" ? "critical" : a.severity === "Warning" ? "warning" : "accent"}>
                  {a.severity.toUpperCase()}
                </Tag>
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
        </div>
      )}
    </div>
  );
}
