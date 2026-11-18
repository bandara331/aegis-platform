"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Toast } from "@/components/ui";
import { AuthShell, PasswordField } from "@/components/auth/AuthShell";

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

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error while authenticating staff account.");
      setLoading(false);
    }
  }

  const darkInput: React.CSSProperties = {
    background: "#161D45",
    borderColor: "#2A3366",
    color: "#fff",
  };
  const darkLabel: React.CSSProperties = { color: "#B7BDDA" };

  return (
    <AuthShell
      theme="staff"
      badge="STAFF & COORDINATOR PORTAL"
      asideTitle="Command & triage console."
      asideLead="Restricted to authorized coordinators, case managers, logistics, shelter, volunteer, donor, and partner officers."
      activeTab="staff"
      trustItems={[
        {
          icon: "shield",
          title: "Tamper-evident audit chain",
          detail: "Every approval, override, and dispatch is sealed with your staff ID.",
        },
        {
          icon: "sparkle",
          title: "AI recommends, humans decide",
          detail: "Inspect explainable priority factors before approving or rejecting.",
        },
        {
          icon: "people",
          title: "Role-based access",
          detail: "Separate staff accounts and critical-case second approver checks.",
        },
      ]}
      footerNote="Staff accounts are provisioned by invitation from a System Administrator."
    >
      <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#fff" }}>
        Staff sign in
      </h1>
      <p style={{ margin: "0 0 22px", fontSize: 14, color: "#A9B4DA" }}>
        Enter your work credentials to access the AEGIS Operations Console.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div>
          <label className="bento-label" style={darkLabel} htmlFor="staff-email">
            Work email
          </label>
          <input
            id="staff-email"
            type="email"
            required
            className="bento-input"
            style={darkInput}
            placeholder="coordinator@aegis.lk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <PasswordField
          id="staff-pass"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter staff password"
          autoComplete="current-password"
          dark
          rightAction={
            <Link
              href="/forgot-password"
              style={{ fontSize: 12, color: "var(--sun)", textDecoration: "none", fontWeight: 600 }}
            >
              Reset password
            </Link>
          }
        />

        {requiresOtp && (
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background: "#161E49",
              border: "1px solid #303D7D",
            }}
          >
            <label className="bento-label" style={darkLabel} htmlFor="staff-otp">
              6-digit security code (sent to your work email)
            </label>
            <input
              id="staff-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              className="bento-input mono"
              style={darkInput}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        )}

        {error && <Toast tone="critical">{error}</Toast>}

        <Button type="submit" variant="cta" fullWidth pill disabled={loading} style={{ minHeight: 52, marginTop: 4 }}>
          {loading ? "Authenticating…" : requiresOtp ? "Verify code & enter console →" : "Enter staff console →"}
        </Button>
      </form>

      <div
        style={{
          marginTop: 22,
          paddingTop: 16,
          borderTop: "1px solid #263168",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 13,
          color: "#A9B4DA",
        }}
      >
        <Link href="/set-password" style={{ color: "#DCE2F7", textDecoration: "none" }}>
          Have a staff invite token?
        </Link>
        <Link href="/login" style={{ color: "#fff", fontWeight: 700, textDecoration: "none" }}>
          Citizen sign in →
        </Link>
      </div>
    </AuthShell>
  );
}
