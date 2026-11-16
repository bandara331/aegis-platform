"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Tag, Toast } from "@/components/ui";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          otp: requiresOtp ? otp.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Staff authentication failed.");
        setLoading(false);
        return;
      }

      if (res.status === 202 || data.requiresOtp) {
        setRequiresOtp(true);
        setLoading(false);
        return;
      }

      // Staff login redirects strictly to /admin
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error while authenticating staff account.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "460px", margin: "24px auto" }}>
      <Card style={{ borderTop: "4px solid var(--ink)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <Tag tone="warning">STAFF OPERATIONS PORTAL</Tag>
          <span className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>RBAC PROTECTED</span>
        </div>

        <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 800 }}>Staff &amp; Coordinator Sign-In</h1>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--muted)" }}>
          Dedicated portal for Emergency Coordinators, Case Managers, Logistics, Shelter Admins, Volunteer/Donor/Partner Officers, and System Admins.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="bento-label" htmlFor="staff-email">OFFICIAL STAFF EMAIL</label>
            <input
              id="staff-email"
              type="email"
              required
              className="bento-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="bento-label" htmlFor="staff-pass">PASSWORD</label>
            <input
              id="staff-pass"
              type="password"
              required
              className="bento-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {requiresOtp && (
            <div>
              <label className="bento-label" htmlFor="staff-otp">SECOND-STEP EMAIL OTP (6 DIGITS)</label>
              <input
                id="staff-otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                className="bento-input mono"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}

          {error && <Toast tone="critical">{error}</Toast>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Verifying clearance…" : requiresOtp ? "Verify 2FA Code & Enter /admin" : "Enter Staff Operations (/admin)"}
          </Button>
        </form>

        <div
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-card)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            color: "var(--muted)",
          }}
        >
          <span>Citizen seeking aid?</span>
          <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
            Citizen login →
          </Link>
        </div>
      </Card>
    </div>
  );
}
