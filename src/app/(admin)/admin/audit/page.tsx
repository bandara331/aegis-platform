import { cookies } from "next/headers";
import { Card, DataTable, ErrorState, PageHeader, Tag } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

interface AuditRow {
  sequenceNumber: number;
  entityName: string;
  entityId: string;
  action: string;
  actorRole: string;
  currentHash: string;
  timestampUtc: string;
}

interface AuditVerifyResult {
  isValid: boolean;
  brokenSequenceNumber?: number | null;
  errorMessage?: string | null;
  totalEntriesVerified: number;
}

export default async function AdminAuditPage() {
  const dict = getDictionary("en");
  const cookieStore = await cookies();
  const token = cookieStore.get("aegis_token")?.value;

  let entries: AuditRow[] = [];
  let verify: AuditVerifyResult | null = null;
  let error: string | null = null;

  if (token) {
    try {
      const [listRes, verifyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/audit?page=1&pageSize=25`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API_BASE_URL}/audit/verify`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);

      if (listRes.ok) {
        const pageData = await listRes.json();
        entries = Array.isArray(pageData.items) ? pageData.items : [];
      } else {
        error = `Audit API returned HTTP ${listRes.status}`;
      }

      if (verifyRes.ok) {
        verify = (await verifyRes.json()) as AuditVerifyResult;
      }
    } catch {
      error = "Unable to connect to AEGIS audit endpoint.";
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <PageHeader
        eyebrow="CRYPTOGRAPHIC TAMPER-EVIDENT LEDGER"
        eyebrowTone="success"
        title="Audit Trail & Hash Chain Verification"
        subtitle="Append-only SHA-256 hash chain guarded by PostgreSQL BEFORE UPDATE / DELETE / TRUNCATE triggers."
      />

      {verify && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <strong>Chain Integrity Check (`GET /api/v1/audit/verify`)</strong>
              <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
                Verified {verify.totalEntriesVerified} chained entries from genesis state.
              </div>
            </div>
            <Tag tone={verify.isValid ? "success" : "critical"}>
              {verify.isValid ? "CHAIN VALID · UNBROKEN" : `BROKEN AT #${verify.brokenSequenceNumber}`}
            </Tag>
          </div>
        </Card>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : (
        <DataTable<AuditRow>
          rows={entries}
          rowKey={(r) => String(r.sequenceNumber)}
          emptyTitle="No audit entries recorded"
          emptyDescription={dict.empty.noAudit}
          columns={[
            { key: "seq", header: "Seq #", render: (r) => <span className="mono">#{r.sequenceNumber}</span> },
            { key: "entity", header: "Entity", render: (r) => `${r.entityName} (${r.entityId.slice(0, 8)})` },
            { key: "action", header: "Action", render: (r) => <Tag tone="accent">{r.action}</Tag> },
            { key: "role", header: "Actor Role", render: (r) => r.actorRole },
            {
              key: "hash",
              header: "SHA-256 Digest",
              render: (r) => <span className="mono" style={{ fontSize: "12px" }}>{r.currentHash.slice(0, 16)}…</span>,
            },
          ]}
        />
      )}
    </div>
  );
}
