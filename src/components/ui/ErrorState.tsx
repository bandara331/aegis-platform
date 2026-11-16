import type { ReactNode } from "react";
import { Card } from "./Card";
import { Tag } from "./Tag";

export interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function ErrorState({
  title = "Unable to load live data",
  message,
  action,
}: ErrorStateProps) {
  return (
    <Card style={{ borderColor: "var(--critical)", background: "#FFF9F9" }}>
      <div style={{ marginBottom: "10px" }}>
        <Tag tone="critical">ERROR STATE</Tag>
      </div>
      <h2 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700, color: "var(--ink)" }}>
        {title}
      </h2>
      <p style={{ margin: "0 0 16px", fontSize: "14px", color: "var(--muted)" }}>
        {message}
      </p>
      {action && <div>{action}</div>}
    </Card>
  );
}
