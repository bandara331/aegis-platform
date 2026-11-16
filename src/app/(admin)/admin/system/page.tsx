import { Card, ErrorState, PageHeader, Tag } from "@/components/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

interface HealthItem {
  serviceName: string;
  status: string;
  details: string;
  lastCheckedAt: string;
}

export default async function AdminSystemHealthPage() {
  let services: HealthItem[] = [];
  let overallStatus = "Unknown";
  let error: string | null = null;

  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      overallStatus = data.overallStatus || "Healthy";
      services = Array.isArray(data.services) ? data.services : [];
    } else {
      error = `Health check returned HTTP ${res.status}`;
    }
  } catch {
    error = "Unable to connect to AEGIS backend health endpoint.";
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow={`OVERALL STATUS · ${overallStatus.toUpperCase()}`}
        eyebrowTone={overallStatus === "Healthy" ? "success" : "warning"}
        title="System Resilience & Subsystem Health"
        subtitle="Monitors PostgreSQL connectivity, Rule-Based AI engine, OSRM routing fallback, and MailKit SMTP email status."
      />

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
