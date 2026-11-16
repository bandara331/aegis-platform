"use client";

import { useEffect, useState } from "react";
import { Button, Card, DataTable, ErrorState, PageHeader, Skeleton, Tag, Toast } from "@/components/ui";

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
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/staff");
        if (!res.ok) {
          setError(`Failed to load staff directory (HTTP ${res.status}).`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setStaff(Array.isArray(data.staff) ? data.staff : []);
      } catch {
        setError("Unable to reach staff management API.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), role, language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invitation failed.");
        return;
      }
      setInviteMsg(`One-time 24h invitation link queued for ${email} (${role}).`);
      setEmail("");
      setFullName("");
    } catch {
      setError("Network error while sending invitation.");
    }
  }

  return (
    <div style={{ display: "grid", gap: "22px" }}>
      <PageHeader
        eyebrow="STAFF GOVERNANCE & RBAC"
        eyebrowTone="accent"
        title="Staff Management & Invitations"
        subtitle="Invite staff with a one-time 24-hour set-password token. Role changes enforce the two-person integrity rule."
      />

      <Card>
        <h2 style={{ margin: "0 0 14px", fontSize: "18px", fontWeight: 700 }}>
          Invite Staff Member
        </h2>
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
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
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
        {inviteMsg && (
          <div style={{ marginTop: "12px" }}>
            <Toast tone="success">{inviteMsg}</Toast>
          </div>
        )}
      </Card>

      {error && <ErrorState message={error} />}

      {loading ? (
        <Skeleton height={56} rows={3} />
      ) : (
        <DataTable<StaffMember>
          rows={staff}
          rowKey={(m) => m.userId}
          emptyTitle="No staff accounts found"
          emptyDescription="Use the bootstrap-admin CLI command or the invitation form above to add staff members."
          columns={[
            { key: "id", header: "User ID", render: (m) => <span className="mono">{m.userId.slice(0, 8)}…</span> },
            { key: "name", header: "Full Name", render: (m) => <strong>{m.fullName}</strong> },
            { key: "email", header: "Email", render: (m) => m.email },
            { key: "roles", header: "Role", render: (m) => <Tag tone="accent">{m.roles.join(", ")}</Tag> },
            {
              key: "status",
              header: "Status",
              render: (m) => (
                <Tag tone={m.isEnabled ? "success" : "critical"}>
                  {m.isEnabled ? "Enabled" : "Disabled"}
                </Tag>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
