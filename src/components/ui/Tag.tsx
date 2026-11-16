import type { ReactNode } from "react";

export type TagTone = "default" | "accent" | "ai" | "critical" | "warning" | "success";

export interface TagProps {
  tone?: TagTone;
  children: ReactNode;
  pulse?: boolean;
}

export function Tag({ tone = "default", children, pulse = false }: TagProps) {
  const palette: Record<TagTone, { bg: string; fg: string; dot: string }> = {
    default: { bg: "#EEF0F4", fg: "var(--muted)", dot: "var(--muted)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)", dot: "var(--accent)" },
    // Violet #7C3AED is strictly reserved for AI output
    ai: { bg: "var(--ai-violet-soft)", fg: "var(--ai-violet)", dot: "var(--ai-violet)" },
    critical: { bg: "var(--critical-soft)", fg: "var(--critical)", dot: "var(--critical)" },
    warning: { bg: "var(--warning-soft)", fg: "#945800", dot: "var(--warning)" },
    success: { bg: "var(--success-soft)", fg: "var(--success)", dot: "var(--success)" },
  };

  const c = palette[tone];

  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        background: c.bg,
        color: c.fg,
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {pulse && (
        <span
          className="live-dot"
          style={{ width: "6px", height: "6px", background: c.dot }}
        />
      )}
      {children}
    </span>
  );
}
