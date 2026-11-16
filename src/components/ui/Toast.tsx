import type { ReactNode } from "react";

export interface ToastProps {
  tone?: "info" | "success" | "warning" | "critical";
  children: ReactNode;
}

export function Toast({ tone = "info", children }: ToastProps) {
  const borderColors = {
    info: "var(--accent)",
    success: "var(--success)",
    warning: "var(--warning)",
    critical: "var(--critical)",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: "12px 16px",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-card)",
        border: `1px solid ${borderColors[tone]}`,
        boxShadow: "var(--shadow-card)",
        fontSize: "13px",
        fontWeight: 500,
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}
