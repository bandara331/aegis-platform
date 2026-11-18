"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, LogoMark, type IconName } from "@/components/icons/Icon";

export interface AuthTrustItem {
  icon: IconName;
  title: string;
  detail: string;
}

export function AuthShell({
  theme,
  badge,
  asideTitle,
  asideLead,
  trustItems,
  activeTab,
  footerNote,
  children,
}: {
  theme: "citizen" | "staff";
  badge: string;
  asideTitle: string;
  asideLead: string;
  trustItems: AuthTrustItem[];
  activeTab?: "login" | "register" | "staff";
  footerNote?: ReactNode;
  children: ReactNode;
}) {
  const isStaff = theme === "staff";

  return (
    <div className="auth-wrap">
      <aside className={`auth-aside ${theme}`}>
        <i className="auth-blob a" aria-hidden="true" />
        <i className="auth-blob b" aria-hidden="true" />

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <LogoMark size={30} />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>AEGIS</span>
          </div>

          <span
            className="mono"
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "5px 12px",
              borderRadius: 999,
              background: isStaff ? "var(--sun)" : "var(--teal-tint)",
              color: isStaff ? "var(--ink)" : "var(--teal)",
              marginBottom: 14,
            }}
          >
            {badge}
          </span>

          <h2 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.12 }}>
            {asideTitle}
          </h2>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: isStaff ? "#B9C3E6" : "var(--muted)" }}>
            {asideLead}
          </p>
        </div>

        <div className="auth-trust" style={{ position: "relative" }}>
          {trustItems.map((item) => (
            <div key={item.title} className="auth-trust-item">
              <div className="auth-trust-ico">
                <Icon name={item.icon} size={16} />
              </div>
              <div>
                <b style={{ display: "block", fontSize: 13 }}>{item.title}</b>
                <span style={{ fontSize: 12.5, opacity: 0.85 }}>{item.detail}</span>
              </div>
            </div>
          ))}
        </div>

        {footerNote && (
          <div style={{ position: "relative", fontSize: 12.5, color: isStaff ? "#A6B0D6" : "var(--muted)" }}>
            {footerNote}
          </div>
        )}
      </aside>

      <section className={`auth-card ${isStaff ? "staff-card" : ""}`}>
        {activeTab && (
          <nav className="auth-tabs" aria-label="Authentication portal">
            <Link href="/login" className={`auth-tab ${activeTab === "login" ? "on" : ""}`}>
              Citizen sign in
            </Link>
            <Link href="/register" className={`auth-tab ${activeTab === "register" ? "on" : ""}`}>
              Create account
            </Link>
            <Link href="/staff/login" className={`auth-tab ${activeTab === "staff" ? "on" : ""}`}>
              Staff portal
            </Link>
          </nav>
        )}
        {children}
      </section>
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
  minLength,
  dark = false,
  showRules = false,
  rightAction,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  dark?: boolean;
  showRules?: boolean;
  rightAction?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const hasMinLen = value.length >= 8;
  const hasDigit = /\d/.test(value);

  const inputStyle: React.CSSProperties | undefined = dark
    ? { background: "#161D45", borderColor: "#2A3366", color: "#fff" }
    : undefined;
  const labelStyle: React.CSSProperties | undefined = dark ? { color: "#B7BDDA" } : undefined;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <label className="bento-label" style={labelStyle} htmlFor={id}>
          {label}
        </label>
        {rightAction}
      </div>
      <div className="auth-pass-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          className="bento-input"
          style={inputStyle}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="auth-pass-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {showRules && (
        <div className="auth-rules">
          <span className={`auth-rule ${hasMinLen ? "ok" : ""}`}>
            {hasMinLen ? "✓" : "○"} 8+ characters
          </span>
          <span className={`auth-rule ${hasDigit ? "ok" : ""}`}>
            {hasDigit ? "✓" : "○"} At least 1 number
          </span>
        </div>
      )}
    </div>
  );
}
