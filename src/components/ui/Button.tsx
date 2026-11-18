import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "cta" | "teal" | "secondary" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  fullWidth?: boolean;
  pill?: boolean;
}

export function Button({
  variant = "primary",
  children,
  fullWidth = false,
  pill = false,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  // Text on coral/sun/mint uses navy ink; text on teal/navy uses white.
  const byVariant: Record<ButtonVariant, CSSProperties> = {
    primary: { background: "var(--ink)", color: "#FFFFFF", border: "1px solid var(--ink)" },
    cta: { background: "var(--coral)", color: "var(--ink)", border: "1px solid var(--coral)" },
    teal: { background: "var(--teal)", color: "#FFFFFF", border: "1px solid var(--teal)" },
    secondary: { background: "#FFFFFF", color: "var(--ink)", border: "1px solid var(--border-card)" },
    danger: { background: "var(--critical)", color: "#FFFFFF", border: "1px solid var(--critical)" },
    ghost: { background: "transparent", color: "var(--muted)", border: "1px solid transparent" },
  };

  return (
    <button
      disabled={disabled}
      style={{
        minHeight: "var(--touch-min)",
        padding: "0 22px",
        borderRadius: pill ? "999px" : "14px",
        fontWeight: 600,
        fontSize: "15px",
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        width: fullWidth ? "100%" : undefined,
        transition: "transform .2s ease, box-shadow .2s ease",
        ...byVariant[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
