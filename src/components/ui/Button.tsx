import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  children,
  fullWidth = false,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const stylesByVariant: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: "var(--accent)",
      color: "#FFFFFF",
      border: "1px solid var(--accent)",
    },
    secondary: {
      background: "var(--bg-card)",
      color: "var(--ink)",
      border: "1px solid var(--border-card)",
    },
    danger: {
      background: "var(--critical)",
      color: "#FFFFFF",
      border: "1px solid var(--critical)",
    },
    ghost: {
      background: "transparent",
      color: "var(--muted)",
      border: "1px solid transparent",
    },
  };

  return (
    <button
      disabled={disabled}
      style={{
        minHeight: "var(--touch-min)",
        padding: "0 20px",
        borderRadius: "var(--radius-md)",
        fontWeight: 600,
        fontSize: "14px",
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        width: fullWidth ? "100%" : undefined,
        transition: "transform 0.15s ease, background 0.15s ease",
        ...stylesByVariant[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
