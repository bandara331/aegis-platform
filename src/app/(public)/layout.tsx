import type { ReactNode } from "react";
import Link from "next/link";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-canvas)" }}>
      <header
        style={{
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border-card)",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            minHeight: "68px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
              color: "var(--ink)",
              fontWeight: 800,
              fontSize: "18px",
              letterSpacing: "0.08em",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
              <path
                d="M14 2 24 6v8c0 6-4.4 10.4-10 12C8.4 24.4 4 20 4 14V6z"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.4"
              />
              <circle cx="14" cy="13" r="3" fill="var(--accent)" />
            </svg>
            AEGIS
          </Link>

          <nav aria-label="Public navigation" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <Link
              href="/alerts"
              style={{
                minHeight: "var(--touch-min)",
                padding: "0 14px",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                color: "var(--muted)",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Public Alerts
            </Link>
            <Link
              href="/login"
              style={{
                minHeight: "var(--touch-min)",
                padding: "0 14px",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                color: "var(--muted)",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Citizen Sign-In
            </Link>
            <Link
              href="/register"
              style={{
                minHeight: "var(--touch-min)",
                padding: "0 16px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-card)",
                background: "var(--bg-card)",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                color: "var(--ink)",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Register
            </Link>
            <Link
              href="/staff/login"
              style={{
                minHeight: "var(--touch-min)",
                padding: "0 16px",
                borderRadius: "var(--radius-md)",
                background: "var(--accent)",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Staff Portal
            </Link>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border-card)",
          background: "var(--bg-card)",
          padding: "20px 24px",
          fontSize: "13px",
          color: "var(--muted)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span className="mono">AEGIS · HUMANITARIAN COORDINATION PLATFORM</span>
          <span>EN · සිංහල · தமிழ் | AI advises, named humans decide, every step is audited.</span>
        </div>
      </footer>
    </div>
  );
}
