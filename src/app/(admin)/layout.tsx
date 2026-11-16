"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, SessionExpiredModal, Tag } from "@/components/ui";

interface RailItem {
  href: string;
  label: string;
  icon: string;
  roles: string[]; // Empty array = accessible to all 8 staff roles
}

const ALL_RAIL_ITEMS: RailItem[] = [
  { href: "/admin", label: "Overview", icon: "◈", roles: [] },
  { href: "/admin/requests", label: "Requests", icon: "☰", roles: ["EmergencyCoordinator", "CaseManager", "SystemAdmin"] },
  { href: "/admin/chat", label: "Chat", icon: "✉", roles: ["EmergencyCoordinator", "CaseManager", "SystemAdmin"] },
  { href: "/admin/map", label: "Map", icon: "⊕", roles: ["EmergencyCoordinator", "CaseManager", "LogisticsManager", "ShelterAdmin", "SystemAdmin"] },
  { href: "/admin/shelters", label: "Shelters", icon: "⌂", roles: ["EmergencyCoordinator", "ShelterAdmin", "SystemAdmin"] },
  { href: "/admin/resources", label: "Resources", icon: "◫", roles: ["EmergencyCoordinator", "LogisticsManager", "SystemAdmin"] },
  { href: "/admin/volunteers", label: "Volunteers", icon: "⚑", roles: ["EmergencyCoordinator", "VolunteerCoordinator", "SystemAdmin"] },
  { href: "/admin/donations", label: "Donations", icon: "♡", roles: ["EmergencyCoordinator", "DonorOfficer", "SystemAdmin"] },
  { href: "/admin/alerts", label: "Alerts", icon: "⚡", roles: ["EmergencyCoordinator", "SystemAdmin"] },
  { href: "/admin/audit", label: "Audit", icon: "⛓", roles: ["EmergencyCoordinator", "PartnerOfficer", "SystemAdmin"] },
  { href: "/admin/reports", label: "Reports", icon: "▤", roles: ["EmergencyCoordinator", "PartnerOfficer", "SystemAdmin"] },
  { href: "/admin/users", label: "Users", icon: "⚙", roles: ["SystemAdmin"] },
  { href: "/admin/system", label: "System", icon: " pulse", roles: ["EmergencyCoordinator", "SystemAdmin"] },
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

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/staff/login");
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <aside className="admin-rail" aria-label="Staff icon rail navigation">
        <Link
          href="/admin"
          title="AEGIS Operations"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "var(--accent)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            textDecoration: "none",
            marginBottom: "8px",
            flexShrink: 0,
          }}
        >
          A
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
              className={`admin-rail-link ${active ? "active" : ""}`.trim()}
              title={item.label}
            >
              <span aria-hidden="true" style={{ fontSize: "15px", lineHeight: 1 }}>
                {item.icon === " pulse" ? "●" : item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="admin-topbar">
          <div style={{ flex: 1, maxWidth: "420px" }}>
            <input
              type="search"
              placeholder="Search requests, shelters, depots, audit logs…"
              aria-label="Search operational records"
              className="bento-input"
              style={{ minHeight: "40px", height: "40px", background: "var(--bg-subtle)" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }} aria-label="Subsystem health status">
              {health.map((h) => {
                const color =
                  h.status === "Healthy"
                    ? "var(--success)"
                    : h.status === "Degraded"
                      ? "var(--warning)"
                      : "var(--critical)";
                return (
                  <Link
                    key={h.serviceName}
                    href="/admin/system"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "12px",
                      color: "var(--muted)",
                      textDecoration: "none",
                    }}
                    title={`${h.serviceName}: ${h.status}`}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: color,
                        display: "inline-block",
                      }}
                    />
                    <span className="mono">{h.serviceName}</span>
                  </Link>
                );
              })}
            </div>

            <Tag tone="accent">{role}</Tag>

            <Button variant="ghost" onClick={handleSignOut} style={{ minHeight: "38px", padding: "0 12px" }}>
              Sign Out
            </Button>
          </div>
        </header>

        <main className="admin-main">{children}</main>
      </div>

      <SessionExpiredModal loginHref="/staff/login" />
    </div>
  );
}
