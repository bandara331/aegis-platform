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
    <Card style={{ padding: 18, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)" }}>
            ACTIVE THREAD · #{active.trackingNumber}
          </span>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
            {active.category} — {active.area}
          </div>
        </div>
        <Link href={`/my-requests/${active.id}`} className="btn btn-ghost btn-sm">
          View status →
        </Link>
      </div>

      {requests.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label className="mono muted" htmlFor="cit-chat-thread" style={{ fontSize: 11, fontWeight: 700 }}>
            SWITCH CASE:
          </label>
          <select
            id="cit-chat-thread"
            className="input"
            style={{ flex: 1, padding: "7px 12px", fontSize: 13 }}
            value={active.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.trackingNumber} · {r.category} ({r.status})
              </option>
            ))}
          </select>
        </div>
      )}

      <LiveRequestChat
        requestId={active.id}
        trackingNumber={active.trackingNumber}
        viewerRole="Citizen"
        height={380}
      />
    </Card>
  );
}
