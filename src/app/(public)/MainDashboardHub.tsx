"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { Card } from "@/components/ui";
import { LiveRequestChat } from "@/components/chat/LiveRequestChat";
import { AiAssistantBox } from "@/components/chat/AiAssistantBox";
import type { RequestDetail } from "@/lib/api/types";

export function MainDashboardHub({
  isLoggedIn,
  isCitizen,
  isStaff,
  citizenRequests,
}: {
  isLoggedIn: boolean;
  isCitizen: boolean;
  isStaff: boolean;
  citizenRequests: RequestDetail[];
}) {
  const [selectedId, setSelectedId] = useState<string>(citizenRequests[0]?.id ?? "");
  const [guestDraft, setGuestDraft] = useState("");
  const [chatLoginPrompt, setChatLoginPrompt] = useState(false);

  const selectedRequest =
    citizenRequests.find((r) => r.id === selectedId) ?? citizenRequests[0] ?? null;

  function handleGuestChatSubmit(e: FormEvent) {
    e.preventDefault();
    setChatLoginPrompt(true);
  }

  return (
    <section
      id="live-hub"
      aria-label="Citizen Chat & AI Hub"
      style={{
        position: "relative",
        zIndex: 2,
        maxWidth: "1208px",
        margin: "20px auto 32px",
        padding: "0 16px",
      }}
    >
      {/* Top status bar for signed-in citizen or staff */}
      {isCitizen && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
            padding: "14px 20px",
            borderRadius: 24,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid var(--border-card)",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="tag tag-mint">CITIZEN SIGNED IN</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              Your live dashboard · {citizenRequests.length} active{" "}
              {citizenRequests.length === 1 ? "request" : "requests"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/request" className="btn btn-coral btn-sm">
              <Icon name="plus" size={14} /> New request
            </Link>
            <Link href="/my-requests" className="btn btn-ghost btn-sm">
              My requests →
            </Link>
          </div>
        </div>
      )}

      {isStaff && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
            padding: "14px 20px",
            borderRadius: 24,
            background: "var(--ink)",
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="tag tag-sun">STAFF SESSION ACTIVE</span>
            <span style={{ fontSize: 14 }}>
              Open the Coordinator Console to triage requests and reply to citizens.
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/chat" className="btn btn-teal btn-sm">
              <Icon name="chat" size={14} /> Open Staff Chat Inbox
            </Link>
            <Link href="/admin" className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)" }}>
              Admin Console →
            </Link>
          </div>
        </div>
      )}

      {/* Main 2-column Hub: Direct Chat with Staff + AI Features */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        {/* 1. Direct Chat with Staff */}
        <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div>
              <span className="tag tag-teal" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="chat" size={12} /> DIRECT CHAT WITH STAFF
              </span>
              <h2 style={{ margin: "8px 0 2px", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
                Message the relief team
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Connected directly to the AEGIS coordinator inbox in real time.
              </p>
            </div>
          </div>

          {!isLoggedIn ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, justifyContent: "space-between" }}>
              {chatLoginPrompt && (
                <div
                  role="alert"
                  style={{
                    padding: "16px 18px",
                    borderRadius: 18,
                    background: "var(--coral-tint)",
                    border: "1.5px solid var(--coral)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <b style={{ fontSize: 15, color: "var(--ink)" }}>You have to log in first</b>
                  <span style={{ fontSize: 13.5, color: "var(--ink)" }}>
                    Direct messaging with relief coordinators requires a verified citizen account so we can link messages to your case.
                  </span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href="/login" className="btn btn-teal btn-sm">
                      Log in as Citizen →
                    </Link>
                    <Link href="/register" className="btn btn-ghost btn-sm">
                      Register account
                    </Link>
                  </div>
                </div>
              )}

              <div
                onClick={() => setChatLoginPrompt(true)}
                style={{
                  minHeight: 220,
                  borderRadius: 18,
                  background: "var(--surface-soft)",
                  border: "1px solid var(--border-card)",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--teal-tint)",
                    color: "var(--teal)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon name="chat" size={20} />
                </div>
                <b style={{ fontSize: 14.5 }}>Live coordinator chat</b>
                <span className="muted" style={{ fontSize: 13, maxWidth: 280 }}>
                  Sign in to chat directly with emergency coordinators and receive live dispatch updates.
                </span>
              </div>

              <form className="chat-composer" onSubmit={handleGuestChatSubmit}>
                <input
                  type="text"
                  placeholder="Write a message to relief staff…"
                  value={guestDraft}
                  onChange={(e) => setGuestDraft(e.target.value)}
                  onFocus={() => setChatLoginPrompt(true)}
                  aria-label="Message relief staff"
                />
                <button type="submit" className="chat-send-btn">
                  <Icon name="send" size={14} /> Send
                </button>
              </form>
            </div>
          ) : isStaff ? (
            <div
              style={{
                flex: 1,
                minHeight: 240,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                gap: 12,
                padding: 20,
                background: "var(--surface-soft)",
                borderRadius: 18,
              }}
            >
              <b>You are signed in as Staff</b>
              <span className="muted" style={{ fontSize: 13 }}>
                Reply to citizen threads from the Staff Chat Inbox.
              </span>
              <Link href="/admin/chat" className="btn btn-teal btn-sm">
                Go to Staff Chat Inbox →
              </Link>
            </div>
          ) : selectedRequest ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {citizenRequests.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <label className="mono muted" htmlFor="hub-req-select" style={{ fontSize: 11.5, fontWeight: 700 }}>
                    REQUEST THREAD:
                  </label>
                  <select
                    id="hub-req-select"
                    className="input"
                    style={{ flex: 1, padding: "7px 12px", fontSize: 13 }}
                    value={selectedRequest.id}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {citizenRequests.map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.trackingNumber} · {r.category} ({r.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {citizenRequests.length === 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                  <span className="mono" style={{ fontWeight: 700 }}>
                    #{selectedRequest.trackingNumber} · {selectedRequest.category}
                  </span>
                  <span className="tag tag-teal">{selectedRequest.status}</span>
                </div>
              )}

              <LiveRequestChat
                requestId={selectedRequest.id}
                trackingNumber={selectedRequest.trackingNumber}
                viewerRole="Citizen"
                height={290}
              />
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: 240,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                gap: 12,
                padding: 20,
                background: "var(--surface-soft)",
                borderRadius: 18,
                border: "1px dashed var(--border-card)",
              }}
            >
              <b style={{ fontSize: 15 }}>No open request thread yet</b>
              <span className="muted" style={{ fontSize: 13, maxWidth: 300 }}>
                Submit an assistance request to open a live two-way chat channel with an emergency coordinator.
              </span>
              <Link href="/request" className="btn btn-coral btn-sm">
                <Icon name="plus" size={14} /> Submit assistance request
              </Link>
            </div>
          )}
        </Card>

        {/* 2. AI Features Box */}
        <Card aiHighlight style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
              AI Guidance &amp; Triage Help
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Multilingual crisis advice powered by AEGIS AI. Advisory only — humans decide all dispatches.
            </p>
          </div>
          <AiAssistantBox isLoggedIn={isLoggedIn} />
        </Card>
      </div>
    </section>
  );
}
