"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import type { AiRecommendationItem, DecisionActionType } from "@/lib/api";

interface FeatureScore {
  name: string;
  weight: number;
}

interface Dispatch {
  type?: string;
  name?: string;
  distanceKm?: number;
  etaMinutes?: number;
  routeSource?: string;
  isEstimated?: boolean;
}

interface Rationale {
  summary?: string;
  suggestedAction?: string;
  suggestedDispatch?: Dispatch;
  alternatives?: string[];
  factors?: string[];
  whyThis?: Record<string, unknown>;
}

const FEATURE_LABELS: Record<string, string> = {
  urgency: "Urgency",
  vulnerability: "Vulnerability",
  timeWaiting: "Time waiting",
  distance: "Distance / ETA",
  resourceFit: "Resource fit",
};

function parseFeatureScores(json: string): FeatureScore[] {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed).map(([k, v]) => ({
        name: FEATURE_LABELS[k] ?? k,
        weight: typeof v === "number" ? Math.round(v <= 1 ? v * 100 : v) : 0,
      }));
    }
  } catch {
    /* ignore */
  }
  return [];
}

function parseRationale(json: string): Rationale {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") return parsed as Rationale;
  } catch {
    if (json?.trim()) return { summary: json };
  }
  return {};
}

export function RequestHeroDecision({
  recommendation,
  caseTitle,
  isCritical,
  decided,
}: {
  recommendation: AiRecommendationItem;
  caseTitle: string;
  isCritical: boolean;
  decided: boolean;
}) {
  const router = useRouter();
  const [justification, setJustification] = useState("");
  const [secondApproverId, setSecondApproverId] = useState("");
  const [overridePriority, setOverridePriority] = useState("High");
  const [activeMode, setActiveMode] = useState<DecisionActionType | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const pct = Math.round(recommendation.confidence <= 1 ? recommendation.confidence * 100 : recommendation.confidence);
  const circumference = 389.56;
  const dashOffset = circumference - (circumference * Math.min(100, Math.max(0, pct))) / 100;
  const features = parseFeatureScores(recommendation.featureScoresJson);
  const rationale = parseRationale(recommendation.rationaleJson);
  const dispatch = rationale.suggestedDispatch;
  const promptVersion = (rationale.whyThis?.promptVersion as string | undefined) ?? "n/a";

  async function submit(action: DecisionActionType) {
    if ((action === "Reject" || action === "Modify") && !justification.trim()) {
      setActiveMode(action);
      setMessage({ text: "A reason is required for this action.", error: true });
      return;
    }
    if (isCritical && !secondApproverId.trim()) {
      setActiveMode(action);
      setMessage({ text: "Critical case: a second approver (user ID) is required.", error: true });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ai/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: recommendation.id,
          action,
          justification: justification.trim(),
          secondApproverId: secondApproverId.trim() || null,
          overridePriority: action === "Modify" ? overridePriority : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error || "Decision rejected by server.", error: true });
      } else {
        setMessage({ text: `Decision recorded: ${action}. Citizen notified, chat updated, audit sealed.` });
        setActiveMode(null);
        setJustification("");
        router.refresh();
      }
    } catch {
      setMessage({ text: "Unable to reach decision endpoint.", error: true });
    } finally {
      setSubmitting(false);
    }
  }

  function choose(action: DecisionActionType) {
    if (action === "Approve" || action === "Defer") {
      if (isCritical && !secondApproverId.trim()) {
        setActiveMode(action);
        setMessage({ text: "Critical case: enter a second approver ID, then confirm.", error: true });
        return;
      }
      void submit(action);
      return;
    }
    if (activeMode === action) void submit(action);
    else setActiveMode(action);
  }

  return (
    <section className="req-hero" aria-label="AI Recommendation">
      <div className="req-hero-top">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className="tag tag-ai">
            <Icon name="sparkle" size={12} /> AI RECOMMENDATION
          </span>
          <span className="tag tag-coral">{recommendation.priority} priority</span>
          <span className="mono muted" style={{ fontSize: "12px" }}>
            Model: {recommendation.modelName} v{recommendation.modelVersion} · Prompt: {promptVersion} · {recommendation.status}
          </span>
        </div>
        <span className="mono muted" style={{ fontSize: "12px" }}>
          Humans decide · AI only recommends
        </span>
      </div>

      <div className="req-hero-body">
        <div className="big-ring">
          <div style={{ position: "relative", width: "150px", height: "150px" }}>
            <svg width="150" height="150" viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="75" cy="75" r="62" stroke="#ECE7FF" strokeWidth="12" fill="none" />
              <circle cx="75" cy="75" r="62" stroke="#7C3AED" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
            </svg>
            <div className="big-ring-num">
              <b>{pct}%</b>
              <span>Confidence</span>
            </div>
          </div>
        </div>

        <div className="req-mid">
          <h2>{caseTitle}</h2>
          {rationale.summary && <p>{rationale.summary}</p>}
          {rationale.suggestedAction && (
            <p style={{ fontWeight: 600, color: "var(--violet)" }}>
              <Icon name="check" size={14} /> Suggested action: {rationale.suggestedAction}
            </p>
          )}
          {features.length > 0 && (
            <div className="fbars">
              {features.map((f) => (
                <div key={f.name} className="fbar">
                  <div className="fbar-row">
                    <span>{f.name}</span>
                    <span className="mono">{f.weight}%</span>
                  </div>
                  <div className="fbar-track">
                    <i style={{ width: `${Math.min(100, Math.max(0, f.weight))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sg">
          <b>Suggested resource / shelter / volunteer</b>
          {dispatch?.name ? (
            <div className="sg-item">
              <div className="sg-ico"><Icon name="check" size={15} /></div>
              <div>
                <div>{dispatch.name}</div>
                <span>
                  {dispatch.type} · {dispatch.distanceKm} km · ETA {dispatch.etaMinutes} min
                  {dispatch.isEstimated && <span className="tag tag-sun" style={{ marginLeft: 6 }}>estimated</span>}
                </span>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: "12.5px", margin: 0 }}>
              No dispatch target was recorded with this recommendation.
            </p>
          )}
          {rationale.alternatives && rationale.alternatives.length > 0 && (
            <>
              <b style={{ marginTop: 10 }}>Alternatives</b>
              {rationale.alternatives.map((a, i) => (
                <div key={i} className="muted" style={{ fontSize: "12.5px" }}>{a}</div>
              ))}
            </>
          )}
        </div>
      </div>

      <button type="button" className="btn btn-subtle btn-sm" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy}>
        {showWhy ? "Hide" : "Why this?"}
      </button>
      {showWhy && (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 16, background: "var(--violet-tint)", fontSize: "13px" }}>
          <b>Signals detected</b>
          <ul style={{ margin: "6px 0 10px 18px" }}>
            {(rationale.factors ?? []).map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <div className="mono" style={{ fontSize: "12px" }}>
            {rationale.whyThis
              ? Object.entries(rationale.whyThis)
                  .filter(([k]) => k !== "detectedSignals")
                  .map(([k, v]) => <div key={k}>{k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}</div>)
              : <div>No additional explanation stored.</div>}
          </div>
        </div>
      )}

      {!decided && activeMode && (
        <div style={{ marginTop: "18px", padding: "16px", borderRadius: "16px", background: "var(--surface-soft)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {(activeMode === "Reject" || activeMode === "Modify") && (
            <div className="field">
              <label className="label">Reason ({activeMode === "Modify" ? "edit" : "reject"}) – required</label>
              <input type="text" className="input" value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Reason recorded in audit log and sent to citizen" />
            </div>
          )}
          {activeMode === "Modify" && (
            <div className="field">
              <label className="label">Override priority</label>
              <select className="input" value={overridePriority} onChange={(e) => setOverridePriority(e.target.value)}>
                {["Critical", "High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          )}
          {isCritical && (
            <div className="field">
              <label className="label">Second approver user ID (critical) – required</label>
              <input type="text" className="input" value={secondApproverId} onChange={(e) => setSecondApproverId(e.target.value)} placeholder="Different staff member's user ID" />
            </div>
          )}
        </div>
      )}

      {message && (
        <div className="mono" role="status" style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, fontSize: "12.5px", background: message.error ? "var(--coral-tint)" : "var(--mint-tint)", color: "var(--ink)" }}>
          {message.text}
        </div>
      )}

      <div className="req-hero-foot">
        <div className="note">
          <Icon name="shield" size={16} />
          <span>Every decision is audited with the AI recommendation, confidence and your action.{isCritical ? " This is a critical case: a second approver is required." : ""}</span>
        </div>
        {decided ? (
          <span className="tag tag-mint">Decision already recorded ({recommendation.status})</span>
        ) : (
          <div className="acts">
            <button type="button" className="btn btn-coral" disabled={submitting} onClick={() => choose("Approve")}>
              <Icon name="check" size={16} /> Approve
            </button>
            <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => choose("Modify")}>
              {activeMode === "Modify" ? "Confirm edit" : "Edit"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => choose("Reject")}>
              {activeMode === "Reject" ? "Confirm reject" : "Reject"}
            </button>
            <button type="button" className="btn btn-subtle" disabled={submitting} onClick={() => choose("Defer")}>
              Defer
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
