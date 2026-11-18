import Link from "next/link";
import { getAiStatus, getRecommendationForRequest, getRequestById, getRequestDuplicates } from "@/lib/api";
import { Icon } from "@/components/icons/Icon";
import { EmptyState, ErrorState } from "@/components/ui";
import { RequestHeroDecision } from "./RequestHeroDecision";
import { DuplicatesPanel } from "./DuplicatesPanel";

export default async function AdminRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: req, error } = await getRequestById(id);

  if (error) return <ErrorState message={error} />;
  if (!req) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <EmptyState title="Request not found" description={`No assistance request matches “${id}”.`} />
        <Link href="/admin/requests" className="btn btn-ghost btn-sm">← Back to requests</Link>
      </div>
    );
  }

  const [{ data: rec, error: recError }, { data: dups, error: dupError }, { data: aiStatus }] = await Promise.all([
    getRecommendationForRequest(req.id),
    getRequestDuplicates(req.id),
    getAiStatus(),
  ]);

  const decided = !rec || rec.status !== "Pending";
  const isCritical = (rec?.priority ?? req.priority) === "Critical" || req.category.toLowerCase() === "medical";
  const lat = req.latitude;
  const lon = req.longitude;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
  const d = 0.01;
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d},${lat - d},${lon + d},${lat + d}&layer=mapnik&marker=${lat},${lon}`
    : null;
  const history = (req.timeline ?? []).filter((t) => t.completed);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>#{req.trackingNumber}</span>
            <span className="tag tag-teal">{req.category}</span>
            <span className="tag tag-muted">{req.status}</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", marginTop: 6, marginBottom: 0 }}>
            {req.category} · {req.area}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/requests" className="btn btn-ghost btn-sm">← Back to requests</Link>
          <Link href="/admin/chat" className="btn btn-teal btn-sm"><Icon name="chat" size={14} /> Chat with citizen</Link>
        </div>
      </div>

      {recError && <div style={{ marginTop: 18 }}><ErrorState message={recError} /></div>}
      {rec ? (
        <RequestHeroDecision recommendation={rec} caseTitle={req.description} isCritical={isCritical} decided={decided} />
      ) : (
        !recError && (
          <div style={{ marginTop: 18 }}>
            <EmptyState title="No AI recommendation recorded" description="No recommendation exists in the database for this request." />
          </div>
        )
      )}

      {aiStatus?.isPaused && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #F59E0B",
            background: "#FFFBEB",
            color: "#92400E",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          AI paused — Kill switch is active. Requests are routed to ManualTriage for human assessment.
        </div>
      )}

      {req.rejectionReason && (
        <div className="sub-card" style={{ marginTop: 18 }}>
          <div className="sub-head"><h3>Rejection reason</h3></div>
          <div>{req.rejectionReason}</div>
        </div>
      )}

      <div className="req-grid">
        <div className="sub-card">
          <div className="sub-head">
            <h3>Citizen details</h3>
            <span className="tag tag-muted">{req.language.toUpperCase()}</span>
          </div>
          <Row k="NIC" v={req.maskedNic || "Not on file"} mono />
          <Row k="Mobile" v={req.contactMobile || "—"} />
          <Row k="Email" v={req.contactEmail || "—"} />
          <Row k="People affected" v={String(req.peopleCount)} />
          <Row k="Vulnerable / medical" v={req.vulnerableFlags || "None declared"} />
          <div className="sub-head" style={{ marginTop: 14 }}>
            <h3>Message</h3>
            {req.detectedLanguage && (
              <span className="tag tag-muted">{req.detectedLanguage}</span>
            )}
            {(req.aiTranslated || (req.englishTranslation && req.englishTranslation !== req.description)) && (
              <span className="tag tag-ai">
                AI translated
                {typeof req.languageConfidence === "number" ? ` · ${Math.round(req.languageConfidence * 100)}%` : ""}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: req.englishTranslation ? "repeat(auto-fit, minmax(200px, 1fr))" : "1fr" }}>
            <div>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>Original</div>
              <div className="msg-orig">{req.description}</div>
              {req.normalizedText && req.normalizedText !== req.description && (
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                  Normalized: {req.normalizedText}
                </div>
              )}
            </div>
            {req.englishTranslation && (
              <div>
                <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>English</div>
                <div className="msg-orig" style={{ borderColor: "rgba(124, 58, 237, 0.25)", background: "rgba(124, 58, 237, 0.04)" }}>
                  {req.englishTranslation}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sub-card">
          <div className="sub-head">
            <h3>Location</h3>
            <span className="mono muted" style={{ fontSize: 11.5 }}>
              {hasCoords ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : req.area}
            </span>
          </div>
          {mapSrc ? (
            <iframe title="Request location" src={mapSrc} style={{ width: "100%", height: 200, border: 0, borderRadius: 16 }} loading="lazy" />
          ) : (
            <div className="muted" style={{ fontSize: 12.5 }}>No coordinates recorded for this request.</div>
          )}
          <Row k="Area" v={req.area} />
          <div className="sub-head" style={{ marginTop: 14 }}><h3>Evidence</h3></div>
          {req.evidence && req.evidence.length > 0 ? (
            req.evidence.map((e) => (
              <div key={e.id} style={{ fontSize: 12.5, padding: "6px 0", borderTop: "1px solid var(--border-card)" }}>
                <b>{e.fileName}</b>
                <div className="muted mono">{e.contentType} · {(e.fileSizeBytes / 1024).toFixed(0)} KB · sha256 {e.sha256Hash.slice(0, 12)}…</div>
              </div>
            ))
          ) : (
            <div className="muted" style={{ fontSize: 12.5 }}>No evidence uploaded.</div>
          )}
        </div>

        <div className="sub-card">
          <div className="sub-head"><h3>History</h3></div>
          {history.length === 0 ? (
            <div className="muted" style={{ fontSize: 12.5 }}>No history recorded.</div>
          ) : (
            <div className="tl">
              {history.map((h, i) => (
                <div className="tl-item" key={i}>
                  <span className="tl-dot" style={{ background: h.current ? "var(--violet)" : "var(--teal)" }} />
                  <div>
                    <b>{h.stage}</b>
                    <span>{h.notes} · {new Date(h.timestampUtc).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DuplicatesPanel requestId={req.id} candidates={Array.isArray(dups) ? dups : []} loadError={dupError} />
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "4px 0" }}>
      <span className="muted">{k}</span>
      <b className={mono ? "mono" : undefined}>{v}</b>
    </div>
  );
}
