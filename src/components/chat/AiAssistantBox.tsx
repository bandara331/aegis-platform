"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";

interface AssistantTurn {
  id: string;
  role: "user" | "ai";
  text: string;
  model?: string;
}

const SAMPLE_PROMPTS = [
  "Flood evacuation checklist",
  "Keeping insulin cool without power",
  "How AEGIS prioritizes requests",
];

export function AiAssistantBox({
  isLoggedIn,
  onRequireLogin,
}: {
  isLoggedIn: boolean;
  onRequireLogin?: () => void;
}) {
  const [language, setLanguage] = useState<"en" | "si" | "ta">("en");
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns.length, loading]);

  async function askAi(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (!isLoggedIn) {
      setLoginRequired(true);
      onRequireLogin?.();
      return;
    }

    setLoginRequired(false);
    setError(null);
    setLoading(true);
    const userTurn: AssistantTurn = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    setTurns((prev) => [...prev, userTurn]);
    setPrompt("");

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, language }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setLoginRequired(true);
        onRequireLogin?.();
      } else if (!res.ok) {
        setError(data.error || "AI assistant is unavailable right now.");
      } else {
        setTurns((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "ai",
            text: data.reply || "",
            model: data.model,
          },
        ]);
      }
    } catch {
      setError("Unable to reach AI assistant.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void askAi(prompt);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
      {/* Header row: AI pill + segmented language switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="tag tag-ai" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="sparkle" size={12} /> AI PREPAREDNESS
        </span>
        <div className="chat-lang-seg" role="group" aria-label="AI reply language">
          {(["en", "si", "ta"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              className={language === lang ? "on" : undefined}
              onClick={() => setLanguage(lang)}
            >
              {lang === "en" ? "English" : lang === "si" ? "සිංහල" : "தமிழ்"}
            </button>
          ))}
        </div>
      </div>

      {/* Login gate notice when unauthenticated */}
      {loginRequired && (
        <div
          role="alert"
          style={{
            padding: "16px 18px",
            borderRadius: 18,
            background: "var(--violet-tint)",
            border: "1.5px solid var(--violet)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <b style={{ fontSize: 15, color: "var(--ink)" }}>You have to log in first</b>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
            Sign in to your citizen account to use AI triage &amp; preparedness features or message the relief team directly.
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/login" className="btn btn-teal btn-sm">
              Sign in as Citizen →
            </Link>
            <Link href="/register" className="btn btn-ghost btn-sm">
              Create account
            </Link>
          </div>
        </div>
      )}

      {/* Conversation stage */}
      <div className="chat-stage ai">
        {turns.length === 0 && !loading ? (
          <div className="chat-empty-card">
            <div className="chat-empty-ico ai">
              <Icon name="sparkle" size={22} />
            </div>
            <b style={{ fontSize: 15, color: "var(--ink)" }}>
              Ask in English, සිංහල, or தமிழ்
            </b>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Get quick flood, medical, or shelter guidance. AI advice is advisory only — human coordinators approve every dispatch.
            </span>
          </div>
        ) : (
          turns.map((t) => (
            <div key={t.id} className={`chat-msg-row ${t.role === "user" ? "mine" : "theirs"}`}>
              <div className={`chat-av ${t.role === "user" ? "mine" : "ai"}`}>
                {t.role === "user" ? "You" : <Icon name="spark" size={14} />}
              </div>
              <div className={`chat-bubble ${t.role === "user" ? "mine" : "theirs ai"}`}>
                {t.text}
                {t.model && (
                  <div className="mono muted" style={{ fontSize: 10.5, marginTop: 6 }}>
                    AI advisory · {t.model}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="chat-typing" aria-label="AI is typing">
            <i /><i /><i />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompt pills */}
      <div className="chat-prompts">
        {SAMPLE_PROMPTS.map((sample) => (
          <button
            key={sample}
            type="button"
            className="chat-chip ai"
            onClick={() => void askAi(sample)}
            disabled={loading}
          >
            <Icon name="spark" size={11} />
            {sample}
          </button>
        ))}
      </div>

      {error && (
        <div className="mono" style={{ fontSize: 12, color: "#9F1E16", padding: "2px 6px" }}>
          {error}
        </div>
      )}

      {/* Pill composer */}
      <form className="chat-composer ai" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask AI for flood safety, first aid, or shelter prep…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          aria-label="Ask AI"
        />
        <button
          type="submit"
          className="chat-send-btn ai"
          disabled={loading || !prompt.trim()}
        >
          <Icon name="spark" size={14} />
          {loading ? "Thinking…" : "Ask AI"}
        </button>
      </form>
    </div>
  );
}
