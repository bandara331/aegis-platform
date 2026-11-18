"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { LiveRequestChat } from "@/components/chat/LiveRequestChat";
import { Icon } from "@/components/icons/Icon";
import type { RequestDetail } from "@/lib/api/types";

export function CitizenChatClient({ requests }: { requests: RequestDetail[] }) {
  const [selectedId, setSelectedId] = useState<string>(requests[0]?.id ?? "");
  const active = requests.find((r) => r.id === selectedId) ?? requests[0] ?? null;

  if (!active) {
    return (
      <EmptyState
        title="No active chat threads yet"
        description="Submit an emergency assistance request to open a direct two-way chat with the AEGIS coordinator team."
        action={
          <Link href="/request" className="btn btn-teal btn-sm" style={{ textDecoration: "none" }}>
            <Icon name="plus" size={14} /> Submit a request
          </Link>
        }
      />
    );
  }

  return (
    <div className="cit-chat-studio">
      {/* Left Case Thread Sidebar */}
      <Card style={{ padding: 18, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div>
            <span className="mono muted" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em" }}>
              DIRECT RELIEF INBOX
            </span>
            <h2 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800 }}>
              Your threads ({requests.length})
            </h2>
          </div>
          <Link href="/request" className="btn btn-coral btn-sm" style={{ textDecoration: "none", padding: "0 12px" }}>
            + New
          </Link>
        </div>

        <div className="cit-thread-list" role="listbox" aria-label="Case chat threads">
          {requests.map((r) => {
            const on = r.id === active.id;
            return (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`cit-thread-btn ${on ? "on" : ""}`.trim()}
                onClick={() => setSelectedId(r.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <span className="mono" style={{ fontSize: 11.5, fontWeight: 800, color: "var(--teal)" }}>
                    #{r.trackingNumber}
                  </span>
                  <span className="tag tag-mint" style={{ padding: "2px 8px", fontSize: 10 }}>
                    {r.status}
                  </span>
                </div>
                <b style={{ fontSize: 14, color: "var(--ink)", fontWeight: 700 }}>
                  {r.category}
                </b>
                <span className="muted" style={{ fontSize: 12 }}>
                  {r.area} · {r.peopleCount} {r.peopleCount === 1 ? "person" : "people"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Right Full Live Coordinator Thread */}
      <Card style={{ padding: 22, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)" }}>
              ACTIVE THREAD · #{active.trackingNumber}
            </span>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
              {active.category} — {active.area}
            </div>
          </div>
          <Link href={`/my-requests/${active.id}`} className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            View timeline &amp; status →
          </Link>
        </div>

        <LiveRequestChat
          requestId={active.id}
          trackingNumber={active.trackingNumber}
          viewerRole="Citizen"
          height={460}
        />
      </Card>
    </div>
  );
}
