import { cookies } from "next/headers";
import Link from "next/link";
import { Button, Card, EmptyState, ErrorState, PageHeader, Tag } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

interface CitizenCaseRow {
  id: string;
  trackingNumber: string;
  category: string;
  description: string;
  area: string;
  status: string;
  priority: string;
}

export default async function CitizenMyRequestsPage() {
  const dict = getDictionary("en");
  const cookieStore = await cookies();
  const token = cookieStore.get("aegis_token")?.value;

  let rows: CitizenCaseRow[] = [];
  let error: string | null = null;

  if (token) {
    try {
      const res = await fetch(`${API_BASE_URL}/requests`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        rows = (await res.json()) as CitizenCaseRow[];
      } else {
        error = `API returned HTTP ${res.status}`;
      }
    } catch {
      error = "Unable to connect to AEGIS backend API.";
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="MY ASSISTANCE REQUESTS"
        eyebrowTone="accent"
        title="Submitted Cases"
        subtitle="Track triage status and coordinator messages for your own requests."
        actions={
          <Link href="/request" style={{ textDecoration: "none" }}>
            <Button variant="primary">New Request</Button>
          </Link>
        }
      />

      {error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No submitted requests"
          description={dict.empty.noRequests}
          action={
            <Link href="/request" style={{ textDecoration: "none" }}>
              <Button variant="primary">Request Emergency Aid</Button>
            </Link>
          }
        />
      ) : (
        <div className="bento-grid">
          {rows.map((r) => (
            <Card key={r.id} interactive>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span className="mono" style={{ fontWeight: 700 }}>{r.trackingNumber}</span>
                <Tag tone={r.priority === "Critical" ? "critical" : "accent"}>{r.status}</Tag>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>
                {r.category} · {r.area}
              </div>
              <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--muted)" }}>{r.description}</p>
              <Link href={`/my-requests/${r.id}`} style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                View status &amp; coordinator chat →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
