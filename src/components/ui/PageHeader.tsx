import type { ReactNode } from "react";
import { Tag, type TagTone } from "./Tag";

export interface PageHeaderProps {
  eyebrow?: string;
  eyebrowTone?: TagTone;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  eyebrowTone = "accent",
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "24px",
      }}
    >
      <div>
        {eyebrow && (
          <div style={{ marginBottom: "8px" }}>
            <Tag tone={eyebrowTone}>{eyebrow}</Tag>
          </div>
        )}
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--muted)", maxWidth: "680px" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>{actions}</div>}
    </header>
  );
}
