import type { ReactNode } from "react";
import { Card } from "./Card";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card style={{ textAlign: "center", padding: "48px 24px" }}>
      <div
        className="mono"
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "var(--muted)",
          marginBottom: "8px",
          textTransform: "uppercase",
        }}
      >
        EMPTY STATE · 0 RECORDS
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: "var(--ink)" }}>
        {title}
      </h2>
      <p style={{ margin: "0 auto 20px", fontSize: "14px", color: "var(--muted)", maxWidth: "460px" }}>
        {description}
      </p>
      {action && <div style={{ display: "inline-flex" }}>{action}</div>}
    </Card>
  );
}
