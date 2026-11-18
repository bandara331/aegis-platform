"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface CitizenRequestActionsProps {
  requestId: string;
  canCancel: boolean;
  canSubmitFeedback: boolean;
  existingRating?: number | null;
  existingComment?: string | null;
}

export function CitizenRequestActions({
  requestId,
  canCancel,
  canSubmitFeedback,
  existingRating,
  existingComment,
}: CitizenRequestActionsProps) {
  const router = useRouter();

  // Cancel state
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Feedback state
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  async function handleCancel(e: FormEvent) {
    e.preventDefault();
    setCancelling(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() || "Cancelled by citizen" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error || "Unable to cancel request.", isError: true });
      } else {
        setMessage({ text: "Your request has been cancelled." });
        setShowCancelPrompt(false);
        router.refresh();
      }
    } catch {
      setMessage({ text: "Network error while cancelling request.", isError: true });
    } finally {
      setCancelling(false);
    }
  }

  async function handleFeedback(e: FormEvent) {
    e.preventDefault();
    setSubmittingFeedback(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error || "Unable to submit feedback.", isError: true });
      } else {
        setMessage({ text: "Thank you! Your feedback has been recorded." });
        router.refresh();
      }
    } catch {
      setMessage({ text: "Network error while submitting feedback.", isError: true });
    } finally {
      setSubmittingFeedback(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "12px", marginTop: "14px" }}>
      {message && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "14px",
            background: message.isError ? "var(--coral-tint)" : "var(--mint-tint)",
            fontSize: "12.5px",
            fontWeight: 600,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Cancel while allowed */}
      {canCancel && (
        <div
          className="card"
          style={{
            borderRadius: "20px",
            padding: "14px 16px",
            background: "var(--surface)",
          }}
        >
          {!showCancelPrompt ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
              <div>
                <b style={{ fontSize: "13px", display: "block" }}>Need to cancel this request?</b>
                <span className="muted" style={{ fontSize: "11.5px" }}>
                  You can cancel before a field team is dispatched.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowCancelPrompt(true)}
              >
                Cancel request
              </button>
            </div>
          ) : (
            <form onSubmit={handleCancel} style={{ display: "grid", gap: "10px" }}>
              <label className="label" htmlFor="cancel-reason">
                Reason for cancelling (optional)
              </label>
              <input
                id="cancel-reason"
                type="text"
                className="input"
                placeholder="e.g. Assistance received from neighbour"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ height: "40px", fontSize: "13px" }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  className="btn btn-coral btn-sm"
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling…" : "Confirm cancel"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowCancelPrompt(false)}
                >
                  Keep request open
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Feedback after completion */}
      {canSubmitFeedback && (
        <form
          onSubmit={handleFeedback}
          className="card"
          style={{
            borderRadius: "20px",
            padding: "16px",
            background: "var(--surface)",
            border: "1.5px solid var(--mint)",
            display: "grid",
            gap: "10px",
          }}
        >
          <div>
            <span className="tag tag-mint" style={{ marginBottom: "6px" }}>
              Completed
            </span>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
              How was the relief delivery?
            </h3>
          </div>

          <div style={{ display: "flex", gap: "6px" }} role="group" aria-label="Star rating 1 to 5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                style={{
                  flex: 1,
                  height: "38px",
                  borderRadius: "10px",
                  border: rating >= star ? "1.5px solid var(--sun)" : "1px solid var(--line)",
                  background: rating >= star ? "var(--sun-tint)" : "var(--surface)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {star} ★
              </button>
            ))}
          </div>

          <textarea
            className="textarea"
            placeholder="Share any comments about the relief delivery (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ minHeight: "68px" }}
          />

          <button type="submit" className="btn btn-teal btn-sm" disabled={submittingFeedback}>
            {submittingFeedback ? "Submitting…" : "Submit feedback"}
          </button>
        </form>
      )}

      {/* Recorded feedback display */}
      {existingRating != null && (
        <div
          className="card"
          style={{
            borderRadius: "20px",
            padding: "14px 16px",
            background: "var(--mint-tint)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ fontSize: "13px" }}>Your feedback</b>
            <span className="mono" style={{ fontWeight: 700 }}>
              {"★".repeat(existingRating)}{"☆".repeat(Math.max(0, 5 - existingRating))} ({existingRating}/5)
            </span>
          </div>
          {existingComment && (
            <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "var(--ink)" }}>
              “{existingComment}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}
