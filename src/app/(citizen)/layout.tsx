"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionExpiredModal } from "@/components/ui";
import { Icon, LogoMark, type IconName } from "@/components/icons/Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/request", label: "Request", icon: "plus" },
  { href: "/my-requests", label: "My requests", icon: "list" },
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/assistant", label: "Assistant", icon: "spark" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export default function CitizenLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="citizen-shell">
      <header className="citizen-bar">
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", color: "inherit" }}>
            <LogoMark size={26} />
            <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-.02em" }}>AEGIS</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/" className="btn btn-ghost btn-sm" style={{ fontSize: 12, padding: "5px 10px" }}>
              Main hub
            </Link>
            <Link href="/chat" className="btn btn-teal btn-sm" style={{ fontSize: 12, padding: "5px 10px" }}>
              <Icon name="chat" size={13} /> Chat
            </Link>
          </div>
        </div>
      </header>

      <main className="citizen-container">{children}</main>

      <nav className="citizen-tabbar" aria-label="Citizen navigation">
        <div className="citizen-tabs">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link key={tab.href} href={tab.href} className={`citizen-tab ${active ? "active" : ""}`.trim()} aria-current={active ? "page" : undefined}>
                <span className="ic"><Icon name={tab.icon} size={18} /></span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <SessionExpiredModal loginHref="/login" />
    </div>
  );
}
