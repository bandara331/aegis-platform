"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(10, 12, 16, 0.35)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          height: "100%",
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border-card)",
          padding: "24px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close drawer">
            ✕
          </Button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
