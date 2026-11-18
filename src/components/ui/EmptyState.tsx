import type { ReactNode } from "react";
import { Card } from "./Card";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card style={{ textAlign: "center", padding: "44px 24px" }}>
      <div
        aria-hidden="true"
        style={{
          width: "56px",
          height: "56px",
          margin: "0 auto 14px",
          borderRadius: "18px",
          background: "var(--teal-tint)",
          color: "var(--teal)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />
        </svg>
      </div>
      <h2 style={{ margin: "0 0 6px", fontSize: "19px", fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</h2>
      <p style={{ margin: "0 auto 18px", fontSize: "14px", color: "var(--muted)", maxWidth: "460px" }}>{description}</p>
      {action && <div style={{ display: "inline-flex" }}>{action}</div>}
    </Card>
  );
}
