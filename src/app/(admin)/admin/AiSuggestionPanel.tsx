"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import type { AiRecommendationItem, DecisionActionType } from "@/lib/api";

interface FeatureScore {
  name: string;
  weight: number;
}

function parseFeatureScores(json: string): FeatureScore[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        name: String(item.name || item.feature || "Signal"),
        weight: Number(item.weight ?? item.score ?? 50),
      }));
    }
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed).map(([k, v]) => ({
        name: k,
        weight: typeof v === "number" ? (v <= 1 ? Math.round(v * 100) : Math.round(v)) : 50,
      }));
    }
  } catch {
    // Fallback empty
  }
  return [];
}

function parseRationale(json: string): { summary?: string; resources?: string[] } {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      return {
        summary: parsed.summary || parsed.rationale || parsed.reason || undefined,
        resources: Array.isArray(parsed.resources) ? parsed.resources.map(String) : undefined,
      };
    }
  } catch {
    if (json && json.trim().length > 0 && !json.trim().startsWith("{")) {
      return { summary: json };
    }
  }
  return {};
}

export function AiSuggestionPanel({
  recommendation,
}: {
  recommendation: AiRecommendationItem | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [showJustificationFor, setShowJustificationFor] = useState<DecisionActionType | null>(null);

  if (!recommendation) {
    return (
      <aside className="ai-panel" aria-label="AI Suggestion">
        <div className="ai-head">
          <span className="tag tag-ai">
            <Icon name="sparkle" size={12} /> AI SUGGESTION
          </span>
          <span className="mono muted" style={{ fontSize: "11.5px" }}>
            Standby
          </span>
        </div>
        <div style={{ padding: "18px 0" }}>
          <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 6px" }}>
            No pending AI suggestions
          </h3>
          <p className="muted" style={{ fontSize: "13px", lineHeight: 1.55, margin: 0 }}>
            When new citizen requests are scored by the advisory engine, the highest-priority recommendation appears here for coordinator review.
          </p>
        </div>
      </aside>
    );
  }

  const pct = Math.round(
    recommendation.confidence <= 1 ? recommendation.confidence * 100 : recommendation.confidence
  );
  const circumference = 238.76;
  const dashOffset = circumference - (circumference * Math.min(100, Math.max(0, pct))) / 100;
  const features = parseFeatureScores(recommendation.featureScoresJson);
  const rationale = parseRationale(recommendation.rationaleJson);

  async function submitDecision(action: DecisionActionType) {
    if ((action === "Reject" || action === "Modify") && !showJustificationFor) {
      setShowJustificationFor(action);
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/ai/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: recommendation?.id,
          action,
          justification:
            justification.trim() || `Coordinator ${action.toLowerCase()}d recommendation.`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback(data.error || "Unable to record decision.");
      } else {
        setFeedback(`Decision recorded: ${action}`);
        setShowJustificationFor(null);
        setJustification("");
        router.refresh();
      }
    } catch {
      setFeedback("Network error while recording decision.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="ai-panel" aria-label="AI Suggestion">
      <div className="ai-head">
        <span className="tag tag-ai">
          <Icon name="sparkle" size={12} /> AI SUGGESTION
        </span>
        <Link
          href={`/admin/requests/${recommendation.requestTrackingNumber || recommendation.requestId}`}
          className="mono muted"
          style={{ fontSize: "11.5px", textDecoration: "none" }}
        >
          #{recommendation.requestTrackingNumber || recommendation.requestId}
        </Link>
      </div>

      <div className="ai-ring-wrap">
        <div className="ring">
          <svg width="92" height="92" viewBox="0 0 92 92">
            <circle cx="46" cy="46" r="38" stroke="#ECE7FF" strokeWidth="8" fill="none" />
            <circle
              cx="46"
              cy="46"
              r="38"
              stroke="#7C3AED"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="ring-num">{pct}%</div>
        </div>
        <div className="ai-ring-meta">
          <span className="tag tag-coral" style={{ marginBottom: "6px" }}>
            {recommendation.priority} priority
          </span>
          <h3> Dispatch recommendation</h3>
          <p className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
            {recommendation.modelName} v{recommendation.modelVersion} · Advisory only
          </p>
        </div>
      </div>

      {rationale.summary && <div className="ai-quote">“{rationale.summary}”</div>}

      {features.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "8px",
            }}
          >
            <span>Why this score</span>
            <span className="mono">Weight</span>
          </div>
          <div className="factors">
            {features.slice(0, 4).map((f) => (
              <div key={f.name} className="factor">
                <div className="factor-row">
                  <span>{f.name}</span>
                  <span className="mono">{f.weight}%</span>
                </div>
                <div className="factor-bar">
                  <i style={{ width: `${Math.min(100, Math.max(0, f.weight))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rationale.resources && rationale.resources.length > 0 && (
        <div className="suggest-box">
          <b>Suggested resources</b>
          <ul>
            {rationale.resources.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {showJustificationFor && (
        <div className="field">
          <label className="label" style={{ fontSize: "11.5px" }}>
            Justification for {showJustificationFor}
          </label>
          <input
            type="text"
            className="input"
            placeholder="Required audit note…"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            style={{ height: "38px", fontSize: "12.5px" }}
          />
        </div>
      )}

      {feedback && (
        <div
          className="mono"
          style={{
            fontSize: "11.5px",
            padding: "8px 10px",
            borderRadius: "10px",
            background: "var(--ai-tint)",
            color: "var(--ai)",
          }}
        >
          {feedback}
        </div>
      )}

      <div className="ai-actions">
        <button
          type="button"
          className="btn btn-coral"
          disabled={submitting}
          onClick={() => submitDecision("Approve")}
        >
          <Icon name="check" size={15} /> Approve
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={submitting}
          onClick={() => submitDecision("Modify")}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={submitting}
          onClick={() => submitDecision("Reject")}
        >
          Reject
        </button>
      </div>
      <button
        type="button"
        className="ai-defer"
        disabled={submitting}
        onClick={() => submitDecision("Defer")}
        style={{ background: "transparent", border: 0, width: "100%" }}
      >
        Decide later · keep in Needs review
      </button>
    </aside>
  );
}
