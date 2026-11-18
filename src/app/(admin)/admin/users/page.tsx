"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Tag, Toast } from "@/components/ui";

interface StaffMember {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  isEnabled: boolean;
  emailConfirmed: boolean;
}

const STAFF_ROLES = [
  "EmergencyCoordinator",
  "CaseManager",
  "LogisticsManager",
  "ShelterAdmin",
  "VolunteerCoordinator",
  "DonorOfficer",
  "PartnerOfficer",
  "SystemAdmin",
];

export default function AdminUsersPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("CaseManager");
  const [language, setLanguage] = useState("en");
  const [inviteMsg, setInviteMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Per-row role change with second approver
  const [roleTarget, setRoleTarget] = useState<Record<string, string>>({});
  const [secondApprover, setSecondApprover] = useState<Record<string, string>>({});

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff", { cache: "no-store" });
      if (!res.ok) {
        setError(`Failed to load staff directory (HTTP ${res.status}).`);
        return;
      }
      const data = await res.json();
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setError(null);
    } catch {
      setError("Unable to reach staff management API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), role, language }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteMsg({ text: data.error || "Invitation failed.", error: true });
        return;
      }
      setInviteMsg({ text: `One-time 24h invitation link queued for ${email} (${role}).` });
      setEmail("");
      setFullName("");
      await loadStaff();
    } catch {
      setInviteMsg({ text: "Network error while sending invitation.", error: true });
    }
  }

  async function handleToggleEnabled(user: StaffMember) {
    setInviteMsg(null);
    const res = await fetch(`/api/ops/admin/staff/${user.userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !user.isEnabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setInviteMsg({ text: data.error || "Status update failed.", error: true });
    else {
      setInviteMsg({ text: `${user.email} is now ${!user.isEnabled ? "Enabled" : "Disabled"}.` });
      await loadStaff();
    }
  }

  async function handleChangeRole(user: StaffMember) {
    const newRole = roleTarget[user.userId] || user.roles[0] || "CaseManager";
    const secId = (secondApprover[user.userId] || "").trim();
    if (!secId) {
      setInviteMsg({ text: "Role changes strictly require a Second Approver User ID (two-person integrity rule).", error: true });
      return;
    }
    setInviteMsg(null);
    const res = await fetch(`/api/ops/admin/staff/${user.userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newRole, secondApproverId: secId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setInviteMsg({ text: data.error || "Role change rejected.", error: true });
    else {
      setInviteMsg({ text: `Role for ${user.email} updated to ${newRole} (2nd approver verified).` });
      await loadStaff();
    }
  }

  return (
    <div style={{ display: "grid", gap: "22px" }}>
      <PageHeader
        eyebrow="STAFF GOVERNANCE & RBAC"
        eyebrowTone="accent"
        title="Staff Management & Invitations"
        subtitle="Invite staff with a one-time 24-hour set-password token, enable/disable accounts, and enforce second approval for role changes."
      />

      <Card>
        <h2 style={{ margin: "0 0 14px", fontSize: "18px", fontWeight: 700 }}>Invite Staff Member</h2>
        <form onSubmit={handleInvite} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "end" }}>
          <div>
            <label className="bento-label" htmlFor="inv-fullname">FULL NAME</label>
            <input id="inv-fullname" type="text" required className="bento-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="bento-label" htmlFor="inv-staff-email">EMAIL ADDRESS</label>
            <input id="inv-staff-email" type="email" required className="bento-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="bento-label" htmlFor="inv-role">ASSIGNED ROLE</label>
            <select id="inv-role" className="bento-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="bento-label" htmlFor="inv-lang">LANGUAGE</label>
            <select id="inv-lang" className="bento-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English (EN)</option>
              <option value="si">සිංහල (SI)</option>
              <option value="ta">தமிழ் (TA)</option>
            </select>
          </div>
          <Button type="submit">Send 24h Invite</Button>
        </form>
      </Card>

      {inviteMsg && <Toast tone={inviteMsg.error ? "critical" : "success"}>{inviteMsg.text}</Toast>}

      {loading ? (
        <Skeleton height={160} />
      ) : error ? (
        <ErrorState message={error} />
      ) : staff.length === 0 ? (
        <EmptyState title="No staff accounts found" description="Invite staff members above to populate the directory." />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-card)", background: "var(--bg-subtle)" }}>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>STAFF MEMBER</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>STATUS</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "left", fontSize: 11 }}>CHANGE ROLE (2ND APPROVER REQUIRED)</th>
                  <th className="mono" style={{ padding: "12px 16px", textAlign: "right", fontSize: 11 }}>ACCOUNT</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.userId} style={{ borderBottom: "1px solid var(--border-card)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <b>{u.fullName}</b>
                      <div className="muted mono" style={{ fontSize: 12 }}>{u.email}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>ID: {u.userId}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Tag tone="accent">{u.roles.join(", ") || "Staff"}</Tag>
                        <Tag tone={u.isEnabled ? "success" : "critical"}>{u.isEnabled ? "Enabled" : "Disabled"}</Tag>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <select
                          className="bento-select"
                          style={{ padding: "6px 10px" }}
                          value={roleTarget[u.userId] ?? (u.roles[0] || "CaseManager")}
                          onChange={(e) => setRoleTarget((p) => ({ ...p, [u.userId]: e.target.value }))}
                        >
                          {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <input
                          className="bento-input mono"
                          style={{ width: 170, padding: "6px 10px" }}
                          placeholder="2nd approver user ID"
                          value={secondApprover[u.userId] ?? ""}
                          onChange={(e) => setSecondApprover((p) => ({ ...p, [u.userId]: e.target.value }))}
                        />
                        <Button type="button" variant="secondary" onClick={() => handleChangeRole(u)}>
                          Apply role
                        </Button>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <Button type="button" variant="secondary" onClick={() => handleToggleEnabled(u)}>
                        {u.isEnabled ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
