"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SessionExpiredModal } from "@/components/ui";
import { Icon, LogoMark, type IconName } from "@/components/icons/Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/request", label: "Request", icon: "plus" },
  { href: "/my-requests", label: "My requests", icon: "list" },
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/assistant", label: "Assistant", icon: "spark" },
  { href: "/alerts", label: "Alerts", icon: "bell" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export default function CitizenLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="citizen-shell">
      <header className="cnav-shell">
        <div className="cnav-bar">
          <div className="cnav-left">
            <button
              type="button"
              onClick={() => router.back()}
              className="cnav-ghost-btn"
              aria-label="Go back"
            >
              ← Back
            </button>
            <Link href="/" className="cnav-ghost-btn">
              <Icon name="home" size={13} /> Home
            </Link>
            <Link href="/" className="cnav-brand">
              <LogoMark size={24} />
              <b>AEGIS</b>
            </Link>
          </div>

          <nav className="cnav-tabs" aria-label="Citizen portal navigation">
            {TABS.map((tab) => {
              const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`cnav-tab ${active ? "active" : ""}`.trim()}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon name={tab.icon} size={14} />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleSignOut}
            className="cnav-signout"
          >
            <Icon name="logout" size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <main className="citizen-container">{children}</main>

      <SessionExpiredModal loginHref="/login" />
    </div>
  );
}
