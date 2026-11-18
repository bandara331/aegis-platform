"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, LogoMark, type IconName } from "@/components/icons/Icon";
import { SessionExpiredModal } from "@/components/ui";

interface RailItem {
  href: string;
  label: string;
  icon: IconName;
  roles: string[]; // Empty array = accessible to all staff roles
}

const ALL_RAIL_ITEMS: RailItem[] = [
  { href: "/admin", label: "Overview", icon: "home", roles: [] },
  { href: "/admin/requests", label: "Requests", icon: "list", roles: ["EmergencyCoordinator", "CaseManager", "SystemAdmin"] },
  { href: "/admin/chat", label: "Chat", icon: "chat", roles: ["EmergencyCoordinator", "CaseManager", "SystemAdmin"] },
  { href: "/admin/map", label: "Map", icon: "pin", roles: ["EmergencyCoordinator", "CaseManager", "LogisticsManager", "ShelterAdmin", "SystemAdmin"] },
  { href: "/admin/shelters", label: "Shelters", icon: "home", roles: ["EmergencyCoordinator", "ShelterAdmin", "SystemAdmin"] },
  { href: "/admin/resources", label: "Resources", icon: "box", roles: ["EmergencyCoordinator", "LogisticsManager", "SystemAdmin"] },
  { href: "/admin/volunteers", label: "Volunteers", icon: "people", roles: ["EmergencyCoordinator", "VolunteerCoordinator", "SystemAdmin"] },
  { href: "/admin/donations", label: "Donations", icon: "heart", roles: ["EmergencyCoordinator", "DonorOfficer", "SystemAdmin"] },
  { href: "/admin/alerts", label: "Alerts", icon: "bell", roles: ["EmergencyCoordinator", "SystemAdmin"] },
  { href: "/admin/audit", label: "Audit", icon: "shield", roles: ["EmergencyCoordinator", "PartnerOfficer", "SystemAdmin"] },
  { href: "/admin/dispatch", label: "Dispatch", icon: "pin", roles: ["EmergencyCoordinator", "PartnerOfficer", "SystemAdmin"] },
  { href: "/admin/reports", label: "Reports", icon: "doc", roles: ["EmergencyCoordinator", "PartnerOfficer", "SystemAdmin"] },
  { href: "/admin/ai", label: "AI Gov", icon: "spark", roles: ["SystemAdmin"] },
  { href: "/admin/users", label: "Users", icon: "user", roles: ["SystemAdmin"] },
  { href: "/admin/system", label: "System", icon: "pulse", roles: ["EmergencyCoordinator", "SystemAdmin"] },
];

interface HealthDot {
  serviceName: string;
  status: string;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>("SystemAdmin");
  const [health, setHealth] = useState<HealthDot[]>([]);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)aegis_role=([^;]*)/);
    if (match?.[1]) {
      setRole(decodeURIComponent(match[1]));
    }

    async function fetchHealth() {
      try {
        const res = await fetch("/api/admin/staff");
        if (res.status === 401) {
          window.dispatchEvent(new CustomEvent("aegis:session-expired"));
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.health?.services)) {
            setHealth(data.health.services);
          }
        }
      } catch {
        // Ignored on offline
      }
    }

    fetchHealth();
  }, []);

  const visibleRail = ALL_RAIL_ITEMS.filter(
    (item) => item.roles.length === 0 || item.roles.includes(role)
  );

  const activeNav =
    ALL_RAIL_ITEMS.find((item) =>
      item.href === "/admin"
        ? pathname === "/admin"
        : pathname === item.href || pathname.startsWith(`${item.href}/`)
    ) ?? ALL_RAIL_ITEMS[0];

  const initials = role
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SA";

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/staff/login");
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <aside className="admin-rail" aria-label="Staff icon rail navigation">
        <Link href="/admin" className="logo" title="AEGIS Operations">
          <LogoMark size={20} />
        </Link>

        {visibleRail.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rail-btn ${active ? "active" : ""}`.trim()}
              title={item.label}
              aria-label={item.label}
            >
              <Icon name={item.icon} size={18} />
            </Link>
          );
        })}

        <div className="rail-spacer" />

        <button
          type="button"
          className="rail-btn"
          title="Sign out"
          aria-label="Sign out"
          onClick={handleSignOut}
          style={{ border: 0, background: "transparent", cursor: "pointer" }}
        >
          <Icon name="logout" size={18} />
        </button>
      </aside>

      <div className="admin-body">
        <header className="admin-top">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-ghost btn-sm"
              aria-label="Go back"
            >
              &larr; Back
            </button>
            <Link href="/" className="btn btn-ghost btn-sm" aria-label="Go to home page">
              <Icon name="home" size={13} /> Home
            </Link>
          </div>

          <div className="crumb">
            <span>AEGIS</span>
            <span>/</span>
            <b>{activeNav.label}</b>
          </div>

          <div className="top-search">
            <Icon name="search" size={14} />
            <input
              type="search"
              placeholder="Search requests, people, shelters…"
              aria-label="Search requests, people, shelters"
              style={{
                border: 0,
                outline: "none",
                background: "transparent",
                fontSize: "13px",
                color: "var(--ink)",
                width: "100%",
              }}
            />
            <kbd>Ctrl K</kbd>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
            <Link
              href="/admin/system"
              className="health"
              title="System health status"
              style={{ textDecoration: "none" }}
            >
              {health.length > 0 ? (
                <>
                  {health.slice(0, 3).map((h) => {
                    const color =
                      h.status === "Healthy"
                        ? "var(--mint)"
                        : h.status === "Degraded"
                          ? "var(--sun)"
                          : "var(--coral)";
                    return (
                      <span
                        key={h.serviceName}
                        className="dot"
                        style={{ background: color }}
                        title={`${h.serviceName}: ${h.status}`}
                      />
                    );
                  })}
                  <span style={{ marginLeft: "4px" }}>
                    {health.every((h) => h.status === "Healthy") ? "All systems OK" : "Check system"}
                  </span>
                </>
              ) : (
                <>
                  <span className="dot" />
                  <span style={{ marginLeft: "4px" }}>System status</span>
                </>
              )}
            </Link>

            <span className="tag tag-teal">{role}</span>
            <div className="avatar" title={role}>
              {initials}
            </div>
          </div>
        </header>

        <main className="admin-main">{children}</main>
      </div>

      <SessionExpiredModal loginHref="/staff/login" />
    </div>
  );
}
