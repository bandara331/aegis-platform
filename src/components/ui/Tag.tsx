import type { ReactNode } from "react";

export type TagTone = "default" | "accent" | "ai" | "critical" | "warning" | "success";

export interface TagProps {
  tone?: TagTone;
  children: ReactNode;
  pulse?: boolean;
}

export function Tag({ tone = "default", children, pulse = false }: TagProps) {
  // Tinted pills; violet is strictly reserved for AI output.
  const palette: Record<TagTone, { bg: string; fg: string; dot: string }> = {
    default: { bg: "#ECEEF5", fg: "#3F4560", dot: "#585E7A" },
    accent: { bg: "#DDF3F4", fg: "#095E68", dot: "#0B7A87" },
    ai: { bg: "#F0E9FE", fg: "#6025D4", dot: "#7C3AED" },
    critical: { bg: "#FDECEC", fg: "#A4262A", dot: "#D13438" },
    warning: { bg: "#FDF1DC", fg: "#8A4B06", dot: "#F5A524" },
    success: { bg: "#E5F6EC", fg: "#0B6B31", dot: "#0E7C3A" },
  };
  const c = palette[tone];

  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 12px",
        borderRadius: "999px",
        background: c.bg,
        color: c.fg,
        fontSize: "12px",
        fontWeight: 500,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      {pulse && <span className="live-dot" style={{ width: "6px", height: "6px", background: c.dot }} />}
      {children}
    </span>
  );
}
