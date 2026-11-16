"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionExpiredModal, Tag } from "@/components/ui";

const TABS = [
  { href: "/request", label: "Request Aid", icon: "＋" },
  { href: "/my-requests", label: "My Requests", icon: "☰" },
  { href: "/assistant", label: "AI Assistant", icon: "✦" },
  { href: "/profile", label: "Profile", icon: "◉" },
];

export default function CitizenLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="citizen-shell">
      <header
        style={{
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border-card)",
          padding: "12px 16px",
        }}
      >
        <div
          style={{
            maxWidth: "680px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/request"
            style={{
              textDecoration: "none",
              color: "var(--ink)",
              fontWeight: 800,
              fontSize: "16px",
              letterSpacing: "0.08em",
            }}
          >
            AEGIS CITIZEN
          </Link>
          <Tag tone="accent">NIC ENCRYPTED</Tag>
        </div>
      </header>

      <main className="citizen-container">{children}</main>

      <nav className="citizen-tabbar" aria-label="Citizen bottom navigation">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`citizen-tab ${active ? "active" : ""}`.trim()}
            >
              <span aria-hidden="true" style={{ fontSize: "16px", lineHeight: 1 }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <SessionExpiredModal loginHref="/login" />
    </div>
  );
}
