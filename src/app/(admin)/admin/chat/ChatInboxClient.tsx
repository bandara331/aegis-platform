"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { EmptyState } from "@/components/ui";
import type { AiRecommendationItem, QueueItem } from "@/lib/api";

type FilterTab = "All" | "Unread" | "Mine" | "Bot handoffs";

interface ChatMessage {
  id: string;
  sender: "citizen" | "staff";
  author: string;
  text: string;
  time: string;
}

const QUICK_REPLIES = [
  "Team is on the way",
  "Please stay on dry ground",
  "Confirm number of people",
  "Shelter space reserved",
];

export function ChatInboxClient({
  cases,
  recommendations,
}: {
  cases: QueueItem[];
  recommendations: AiRecommendationItem[];
}) {
  const [filter, setFilter] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);
  const [draftText, setDraftText] = useState("");
  const [messagesByCase, setMessagesByCase] = useState<Record<string, ChatMessage[]>>({});

  const filteredCases = cases.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!c.id.toLowerCase().includes(q) && !c.need.toLowerCase().includes(q) && !c.area.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filter === "Unread") return c.priority === "critical";
    if (filter === "Bot handoffs") return c.score >= 80;
    return true;
  });

  const activeCase = cases.find((c) => c.id === selectedId) ?? filteredCases[0] ?? null;
  const activeRec = activeCase
    ? recommendations.find(
        (r) => r.requestTrackingNumber === activeCase.id || r.requestId === activeCase.id
      ) ?? null
    : null;

  const activeMessages = activeCase ? messagesByCase[activeCase.id] ?? [] : [];

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!activeCase || !draftText.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const nextMsg: ChatMessage = {
      id: `${Date.now()}`,
      sender: "staff",
      author: "Coordinator",
      text: draftText.trim(),
      time: `${now} · ✓✓`,
    };
    setMessagesByCase((prev) => ({
      ...prev,
      [activeCase.id]: [...(prev[activeCase.id] ?? []), nextMsg],
    }));
    setDraftText("");
  }

  return (
    <div className="chat-shell">
      {/* 1. Conversation list */}
      <aside className="conv-list">
        <div className="conv-top">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Messages</h2>
            <span className="tag tag-coral">{cases.length} active</span>
          </div>
          <div className="conv-search">
            <Icon name="search" size={14} />
            <input
              placeholder="Search name or #id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="pills">
            {(["All", "Unread", "Mine", "Bot handoffs"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`pill ${filter === tab ? "on" : ""}`.trim()}
                onClick={() => setFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="conv-items">
          {filteredCases.length === 0 ? (
            <div style={{ padding: "24px 16px" }}>
              <EmptyState
                title="No threads match"
                description="Active citizen request threads from PostgreSQL will appear here."
              />
            </div>
          ) : (
            filteredCases.map((c) => {
              const on = activeCase?.id === c.id;
              return (
                <div
                  key={c.id}
                  className={`conv ${on ? "on" : ""}`.trim()}
                  onClick={() => setSelectedId(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedId(c.id);
                  }}
                >
                  <div
                    className="conv-av"
                    style={{
                      background:
                        c.priority === "critical"
                          ? "var(--coral)"
                          : c.priority === "high"
                            ? "var(--teal)"
                            : "var(--navy)",
                    }}
                  >
                    #{c.id.slice(-2)}
                  </div>
                  <div className="conv-body">
                    <div className="conv-row">
                      <b>Case #{c.id}</b>
                      <span className="t">{c.wait}</span>
                    </div>
                    <div className="conv-msg">{c.need}</div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "5px", alignItems: "center" }}>
                      <span
                        className={
                          c.priority === "critical"
                            ? "tag tag-coral"
                            : c.priority === "high"
                              ? "tag tag-sun"
                              : "tag tag-teal"
                        }
                        style={{ padding: "2px 7px", fontSize: "10.5px" }}
                      >
                        {c.priority}
                      </span>
                      <span className="mono muted" style={{ fontSize: "10.5px" }}>
                        {c.area}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. Active conversation pane */}
      {!activeCase ? (
        <section className="chat-pane" style={{ justifyContent: "center", padding: "32px" }}>
          <EmptyState
            title="No active communication threads"
            description="When citizens submit emergency requests or message coordinators, their live thread opens here."
          />
        </section>
      ) : (
        <section className="chat-pane">
          <div className="chat-head">
            <div
              className="conv-av"
              style={{
                background:
                  activeCase.priority === "critical" ? "var(--coral)" : "var(--teal)",
              }}
            >
              #{activeCase.id.slice(-2)}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <b style={{ fontSize: "15px" }}>Case #{activeCase.id}</b>
                <span className="tag tag-coral">{activeCase.priority}</span>
              </div>
              <div className="muted" style={{ fontSize: "12px" }}>
                {activeCase.area} · Status: {activeCase.status}
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <Link href={`/admin/requests/${activeCase.id}`} className="btn btn-ghost btn-sm">
                Open request
              </Link>
            </div>
          </div>

          <div className="msgs">
            <div className="day-div">
              <span>CASE #{activeCase.id} THREAD</span>
            </div>

            <div className="b b-in">
              {activeCase.need}
              <span className="meta">
                Citizen request · {activeCase.area} · {activeCase.wait}
              </span>
            </div>

            {activeMessages.map((m) => (
              <div key={m.id} className={m.sender === "staff" ? "b b-out" : "b b-in"}>
                {m.text}
                <span className="meta">
                  {m.author} · {m.time}
                </span>
              </div>
            ))}
          </div>

          {/* AI Suggested Draft Bar */}
          {activeRec && (
            <div className="dr">
              <span className="tag tag-ai">
                <Icon name="sparkle" size={11} /> AI DRAFT
              </span>
              <p>
                “We have received your request #{activeCase.id} in {activeCase.area} and a coordinator is reviewing dispatch options now.”
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ height: "30px", padding: "0 11px", fontSize: "12px" }}
                onClick={() =>
                  setDraftText(
                    `We have received your request #${activeCase.id} in ${activeCase.area} and a coordinator is reviewing dispatch options now.`
                  )
                }
              >
                Insert
              </button>
            </div>
          )}

          {/* Quick reply chips */}
          <div className="qr">
            {QUICK_REPLIES.map((q) => (
              <button key={q} type="button" onClick={() => setDraftText(q)}>
                {q}
              </button>
            ))}
          </div>

          {/* Composer */}
          <form className="cmp" onSubmit={handleSend}>
            <input
              placeholder="Write a reply…"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
            />
            <button type="submit" className="btn btn-teal btn-sm">
              Send
              <Icon name="send" size={14} />
            </button>
          </form>
        </section>
      )}

      {/* 3. Right request context */}
      <aside className="chat-ctx">
        {activeCase ? (
          <>
            <div className="ctx-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4>Linked request</h4>
                <span className="mono" style={{ fontSize: "12px", fontWeight: 700 }}>
                  #{activeCase.id}
                </span>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>
                {activeCase.need}
              </div>
              <div className="ctx-kv">
                <div>
                  <span>Status</span>
                  <b style={{ color: "var(--teal)" }}>{activeCase.status}</b>
                </div>
                <div>
                  <span>Priority</span>
                  <b>{activeCase.priority}</b>
                </div>
                <div>
                  <span>Area</span>
                  <b>{activeCase.area}</b>
                </div>
                <div>
                  <span>Waiting</span>
                  <b className="mono">{activeCase.wait}</b>
                </div>
              </div>
            </div>

            <div className="ctx-ai">
              <span className="tag tag-ai">
                <Icon name="sparkle" size={11} /> AI SUMMARY
              </span>
              <p style={{ marginTop: "8px" }}>
                Advisory urgency score: <b>{activeCase.score}%</b> ({activeCase.priority.toUpperCase()}). All dispatch actions require coordinator confirmation.
              </p>
            </div>

            <div className="ctx-card">
              <h4>Location</h4>
              <div className="ctx-map">
                <svg viewBox="0 0 280 110" preserveAspectRatio="none">
                  <rect width="280" height="110" fill="#E6EEF6" />
                  <path
                    d="M0 72 Q 90 50 170 78 T 280 65 L 280 110 L 0 110 Z"
                    fill="#B8DFEC"
                    opacity=".75"
                  />
                  <circle cx="175" cy="62" r="13" fill="#FF5A4F" opacity=".25" />
                  <circle
                    cx="175"
                    cy="62"
                    r="5.5"
                    fill="#FF5A4F"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="muted" style={{ fontSize: "12px", marginTop: "8px" }}>
                {activeCase.area}
              </div>
            </div>

            <Link
              href={`/admin/requests/${activeCase.id}`}
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: "center" }}
            >
              View full request &amp; AI card →
            </Link>
          </>
        ) : (
          <div className="ctx-card">
            <h4>Request context</h4>
            <p className="muted" style={{ fontSize: "12.5px", margin: 0 }}>
              Select a conversation on the left to inspect linked request details, AI advisory score, and location.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
