"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { EmptyState } from "@/components/ui";
import { LiveRequestChat } from "@/components/chat/LiveRequestChat";
import type {
  AiRecommendationItem,
  ChatSummaryDto,
  HandoverNoteDto,
  QueueItem,
  SuggestedReplyDto,
} from "@/lib/api";

type FilterTab = "All" | "Unread" | "Mine" | "Bot handoffs";

const QUICK_REPLIES = [
  "Team is on the way",
  "Please stay on dry ground",
  "Confirm number of people",
  "Shelter space reserved",
];

export function ChatInboxClient({
  cases,
}: {
  cases: QueueItem[];
  recommendations?: AiRecommendationItem[];
}) {
  const [filter, setFilter] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Record<string, boolean>>({});

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<ChatSummaryDto | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [suggestedReply, setSuggestedReply] = useState<SuggestedReplyDto | null>(null);
  const [replyEditing, setReplyEditing] = useState(false);
  const [replyEditText, setReplyEditText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [externalDraft, setExternalDraft] = useState<{ text: string; isAiDraft?: boolean } | null>(null);

  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverSinceHours, setHandoverSinceHours] = useState(8);
  const [handoverData, setHandoverData] = useState<HandoverNoteDto | null>(null);
  const [handoverLoading, setHandoverLoading] = useState(false);

  async function loadSummary(caseId: string) {
    setSummaryLoading(true);
    setSummaryOpen(true);
    try {
      const res = await fetch(`/api/ops/ai/chat/${encodeURIComponent(caseId)}/summary`, { method: "POST" });
      if (res.ok) setSummaryData((await res.json()) as ChatSummaryDto);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadSuggestedReply(caseId: string) {
    setReplyLoading(true);
    setReplyEditing(false);
    try {
      const res = await fetch(`/api/ops/ai/chat/${encodeURIComponent(caseId)}/suggest-reply`, { method: "POST" });
      if (res.ok) {
        const d = (await res.json()) as SuggestedReplyDto;
        setSuggestedReply(d);
        setReplyEditText(d.draftText);
      }
    } finally {
      setReplyLoading(false);
    }
  }

  async function acknowledgeDistress(caseId: string) {
    const res = await fetch(`/api/ops/ai/distress/${encodeURIComponent(caseId)}/acknowledge`, { method: "POST" });
    if (res.ok) {
      setAcknowledgedIds((prev) => ({ ...prev, [caseId]: true }));
    }
  }

  async function loadHandover(hours = handoverSinceHours) {
    setHandoverOpen(true);
    setHandoverLoading(true);
    try {
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const res = await fetch(`/api/ops/ai/handover?since=${encodeURIComponent(since)}`, { cache: "no-store" });
      if (res.ok) setHandoverData((await res.json()) as HandoverNoteDto);
    } finally {
      setHandoverLoading(false);
    }
  }

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

  return (
    <div className="chat-shell">
      {/* 1. Conversation list */}
      <aside className="conv-list">
        <div className="conv-top">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
            <h2>Messages</h2>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadHandover()}>
                Handover
              </button>
              <span className="tag tag-coral">{cases.length} active</span>
            </div>
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
                      {c.distressFlagged && !c.distressAcknowledgedAt && !acknowledgedIds[c.id] && (
                        <span
                          style={{
                            marginLeft: "auto",
                            background: "#DC2626",
                            color: "#fff",
                            borderRadius: 999,
                            padding: "1px 7px",
                            fontSize: "10px",
                            fontWeight: 700,
                          }}
                        >
                          DISTRESS
                        </span>
                      )}
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
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {activeCase.distressFlagged && !activeCase.distressAcknowledgedAt && !acknowledgedIds[activeCase.id] && (
                <button
                  type="button"
                  onClick={() => void acknowledgeDistress(activeCase.id)}
                  style={{
                    background: "#DC2626",
                    color: "#fff",
                    border: 0,
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Acknowledge Distress
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ borderColor: "rgba(124,58,237,0.35)", color: "var(--violet)" }}
                onClick={() => (summaryOpen ? setSummaryOpen(false) : void loadSummary(activeCase.id))}
              >
                {summaryOpen ? "Hide AI Summary" : "AI Summary"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ borderColor: "rgba(124,58,237,0.35)", color: "var(--violet)" }}
                onClick={() => void loadSuggestedReply(activeCase.id)}
                disabled={replyLoading}
              >
                {replyLoading ? "Drafting…" : "Suggest Reply"}
              </button>
              <Link href={`/admin/requests/${activeCase.id}`} className="btn btn-ghost btn-sm">
                Open request
              </Link>
            </div>
          </div>

          <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, padding: "10px 14px", borderRadius: 14, background: "var(--surface-soft)", border: "1px solid var(--border-card)" }}>
              <b>Initial need:</b> {activeCase.need} <span className="muted">({activeCase.area} · {activeCase.wait})</span>
            </div>

            {summaryOpen && (
              <div style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span className="tag tag-ai">AI Summary</span>
                  <button type="button" onClick={() => setSummaryOpen(false)} style={{ background: "none", border: 0, cursor: "pointer", fontSize: 12 }}>
                    Collapse
                  </button>
                </div>
                {summaryLoading ? (
                  <div className="muted" style={{ fontSize: 12.5 }}>Summarizing conversation…</div>
                ) : summaryData && summaryData.bullets.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
                    {summaryData.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                ) : (
                  <div className="muted" style={{ fontSize: 12.5 }}>No summary available.</div>
                )}
              </div>
            )}

            {suggestedReply && (
              <div style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(124,58,237,0.35)", background: "rgba(124,58,237,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span className="tag tag-ai">AI Suggested Reply ({suggestedReply.targetLanguage}) · Draft only</span>
                </div>
                {replyEditing ? (
                  <textarea
                    rows={3}
                    value={replyEditText}
                    onChange={(e) => setReplyEditText(e.target.value)}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border-card)", padding: 8, fontSize: 13 }}
                  />
                ) : (
                  <p style={{ margin: "4px 0 8px", fontSize: 13 }}>{replyEditText}</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: "var(--violet)", color: "#fff" }}
                    onClick={() => {
                      setExternalDraft({ text: replyEditText, isAiDraft: true });
                      setSuggestedReply(null);
                    }}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setReplyEditing((v) => !v)}
                  >
                    {replyEditing ? "Done editing" : "Edit"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSuggestedReply(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <LiveRequestChat
              requestId={activeCase.id}
              trackingNumber={activeCase.id}
              viewerRole="Staff"
              quickReplies={QUICK_REPLIES}
              height={320}
              externalDraft={externalDraft}
              onExternalDraftConsumed={() => setExternalDraft(null)}
            />
          </div>
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

      {handoverOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{ width: "100%", maxWidth: 640, background: "#fff", borderRadius: 16, padding: 20, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <span className="tag tag-ai">AI Shift Handover</span>
                <h3 style={{ margin: "6px 0 0" }}>What changed across your requests</h3>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHandoverOpen(false)}>Close</button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>Lookback window:</span>
              {[4, 8, 12, 24].map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`pill ${handoverSinceHours === h ? "on" : ""}`.trim()}
                  onClick={() => {
                    setHandoverSinceHours(h);
                    void loadHandover(h);
                  }}
                >
                  {h}h
                </button>
              ))}
            </div>
            {handoverLoading ? (
              <div className="muted" style={{ fontSize: 13 }}>Building handover from PostgreSQL…</div>
            ) : handoverData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{handoverData.summaryText}</div>
                {handoverData.items.length === 0 ? (
                  <EmptyState title="No changes in window" description="No assigned requests or distress alerts changed in this window." />
                ) : (
                  handoverData.items.map((item) => (
                    <div key={item.requestId} style={{ border: "1px solid var(--border-card)", borderRadius: 10, padding: 10, fontSize: 12.5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <b>#{item.trackingNumber} · {item.area}</b>
                        <span className="tag tag-muted">{item.priority} · {item.status}</span>
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>{item.changeSummary}</div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>Unable to load handover note.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
