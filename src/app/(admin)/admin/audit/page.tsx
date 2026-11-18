"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, Tag, Toast } from "@/components/ui";

interface AuditRow {
  sequenceNumber: number;
  entityName: string;
  entityId: string;
  action: string;
  actorRole: string;
  actorId?: string;
  currentHash: string;
  previousHash?: string;
  timestampUtc: string;
}

interface AuditVerifyResult {
  isValid: boolean;
  brokenSequenceNumber?: number | null;
  errorMessage?: string | null;
  totalEntriesVerified: number;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [verify, setVerify] = useState<AuditVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/audit?page=1&pageSize=30", { cache: "no-store" });
      if (!res.ok) {
        setError(`Audit API returned HTTP ${res.status}.`);
        return;
      }
      const data = await res.json();
      setEntries(Array.isArray(data.items) ? data.items : []);
      setError(null);
    } catch {
      setError("Unable to reach audit endpoint.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  async function handleVerifyChain() {
    setVerifying(true);
    try {
      const res = await fetch("/api/ops/audit/verify", { cache: "no-store" });
      if (res.ok) {
        setVerify((await res.json()) as AuditVerifyResult);
      } else {
        setError(`Verification returned HTTP ${res.status}.`);
      }
    } catch {
      setError("Failed to verify hash chain.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <PageHeader
          eyebrow="CRYPTOGRAPHIC TAMPER-EVIDENT LEDGER"
          eyebrowTone="success"
          title="Audit Trail & Hash Chain"
          subtitle="Append-only SHA-256 hash chain guarded by PostgreSQL BEFORE UPDATE / DELETE / TRUNCATE triggers."
        />
        <Button type="button" onClick={handleVerifyChain} disabled={verifying}>
          {verifying ? "Verifying chain…" : "Verify chain"}
        </Button>
      </div>

      {verify && (
        <Toast tone={verify.isValid ? "success" : "critical"}>
          {verify.isValid
            ? `CHAIN VALID · UNBROKEN — Verified ${verify.totalEntriesVerified} chained entries from genesis.`
            : `CHAIN BROKEN AT SEQ #${verify.brokenSequenceNumber}: ${verify.errorMessage || "Hash mismatch"}`}
        </Toast>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <Card><div className="muted">Loading audit timeline…</div></Card>
      ) : entries.length === 0 ? (
        <EmptyState title="No audit entries recorded" description="Actions across requests, decisions, shelters, and users will appear here." />
      ) : (
        <Card>
          <div className="tl">
            {entries.map((r) => (
              <div key={r.sequenceNumber} className="tl-item">
                <span className="tl-dot" style={{ background: "var(--teal)" }} />
                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <b className="mono">#{r.sequenceNumber}</b> · <Tag tone="accent">{r.action}</Tag>{" "}
                      <span>{r.entityName} ({r.entityId.slice(0, 8)})</span>
                    </div>
                    <span className="mono muted" style={{ fontSize: 11.5 }}>
                      {new Date(r.timestampUtc).toLocaleString()}
                    </span>
                  </div>
                  <span className="mono muted" style={{ fontSize: 11.5 }}>
                    Actor: {r.actorRole} · SHA-256: {r.currentHash.slice(0, 20)}…
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
