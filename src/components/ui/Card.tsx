import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  aiHighlight?: boolean;
}

export function Card({
  children,
  interactive = false,
  aiHighlight = false,
  className = "",
  style,
  ...rest
}: CardProps) {
  return (
    <div
      className={`bento-card ${interactive ? "interactive" : ""} ${className}`.trim()}
      style={{
        borderColor: aiHighlight ? "var(--ai-violet)" : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
