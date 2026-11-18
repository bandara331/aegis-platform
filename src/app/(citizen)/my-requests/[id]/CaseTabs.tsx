"use client";

import { useState, type ReactNode } from "react";

export function CaseTabs({ status, chat }: { status: ReactNode; chat: ReactNode }) {
  const [tab, setTab] = useState<"status" | "chat">("chat");

  return (
    <div>
      <div className="case-tabs" role="group" aria-label="Case view">
        <button type="button" aria-pressed={tab === "status"} onClick={() => setTab("status")}>Status</button>
        <button type="button" aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>Chat</button>
      </div>
      {tab === "status" ? status : chat}
    </div>
  );
}
