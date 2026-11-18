"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons/Icon";
import type { RequestChatMessage } from "@/lib/api/types";

export function LiveRequestChat({
  requestId,
  trackingNumber,
  viewerRole,
  quickReplies,
  height = 340,
  externalDraft,
  onExternalDraftConsumed,
}: {
  requestId: string;
  trackingNumber?: string;
  viewerRole: "Citizen" | "Staff";
  quickReplies?: string[];
  height?: number;
  externalDraft?: { text: string; isAiDraft?: boolean } | null;
  onExternalDraftConsumed?: () => void;
}) {
  const [messages, setMessages] = useState<RequestChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [usingAiDraft, setUsingAiDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (externalDraft?.text) {
      setDraft(externalDraft.text);
      setUsingAiDraft(Boolean(externalDraft.isAiDraft));
      onExternalDraftConsumed?.();
    }
  }, [externalDraft, onExternalDraftConsumed]);

  const loadMessages = useCallback(async (silent = false) => {
    if (!requestId) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/messages`, {
        cache: "no-store",
      });
      if (!res.ok) {
        if (!silent) setError("Could not load messages.");
        return;
      }
      const data = (await res.json()) as RequestChatMessage[];
      setMessages(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      if (!silent) setError("Unable to reach chat service.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadMessages(false);
    const id = setInterval(() => {
      void loadMessages(true);
    }, 4000);
    return () => clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageText: trimmed, usedAiDraft: usingAiDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to send message.");
      } else {
        setMessages((prev) => [...prev, data as RequestChatMessage]);
        setDraft("");
        setUsingAiDraft(false);
      }
    } catch {
      setError("Network error while sending message.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void sendText(draft);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
      <div className="chat-stage" style={{ minHeight: height, maxHeight: height + 60 }}>
        {loading ? (
          <div className="muted mono" style={{ margin: "auto", fontSize: 12.5 }}>
            Loading conversation…
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty-card">
            <div className="chat-empty-ico staff">
              <Icon name="chat" size={22} />
            </div>
            <b style={{ fontSize: 15, color: "var(--ink)" }}>
              {trackingNumber ? `Thread #${trackingNumber} ready` : "Direct thread ready"}
            </b>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {viewerRole === "Citizen"
                ? "Send a message below to reach the AEGIS relief coordinator team directly."
                : "No messages yet. Send a message below to update the citizen."}
            </span>
          </div>
        ) : (
          messages.map((m) => {
            if (m.isSystem || m.senderRole === "System") {
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: "center",
                    background: "#fff",
                    border: "1px solid var(--border-card)",
                    borderRadius: 999,
                    padding: "6px 14px",
                    fontSize: 12,
                    color: "var(--muted)",
                    textAlign: "center",
                    maxWidth: "92%",
                  }}
                >
                  {m.messageText}
                </div>
              );
            }

            const isMine =
              (viewerRole === "Citizen" && m.senderRole === "Citizen") ||
              (viewerRole === "Staff" && m.senderRole === "Staff");

            return (
              <div key={m.id} className={`chat-msg-row ${isMine ? "mine" : "theirs"}`}>
                <div className={`chat-av ${isMine ? "mine" : "staff"}`}>
                  {isMine ? "You" : m.senderRole === "Staff" ? "HQ" : "CZ"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", gap: 3 }}>
                  <div className={`chat-bubble ${isMine ? "mine teal" : "theirs"}`}>
                    {m.messageText}
                  </div>
                  <span className="mono muted" style={{ fontSize: 10.5, padding: "0 4px" }}>
                    {isMine ? "You" : m.senderName} ·{" "}
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {quickReplies && quickReplies.length > 0 && (
        <div className="chat-prompts">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              className="chat-chip"
              onClick={() => setDraft(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mono" style={{ fontSize: 12, color: "#9F1E16", padding: "2px 6px" }}>
          {error}
        </div>
      )}

      <form className="chat-composer" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={
            viewerRole === "Citizen"
              ? "Message the relief coordinator…"
              : "Reply to citizen…"
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending}
          aria-label="Message"
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={sending || !draft.trim()}
        >
          <Icon name="send" size={14} />
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
