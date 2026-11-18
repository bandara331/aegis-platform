"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui";
import { AuthShell, NeoField, PasswordField } from "@/components/auth/AuthShell";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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

  return (
    <AuthShell
      theme="staff"
      asideTitle="Command & triage portal"
      formTitle={
        <>
          Staff command
          <br />
          portal
        </>
      }
      activeTab="staff"
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 11 }}>
        <NeoField
          id="staff-email"
          label="Work email"
          type="email"
          inputMode="email"
          placeholder="Work email (coordinator@aegis.lk)"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          valid={email.trim().length > 0 ? emailValid : undefined}
          statusText={email.trim().length > 0 && emailValid ? "✓" : undefined}
        />

        <PasswordField
          id="staff-pass"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Staff password"
          autoComplete="current-password"
          rightAction={
            <Link
              href="/forgot-password"
              style={{ fontSize: 11, color: "#274A43", textDecoration: "none", fontWeight: 600 }}
            >
              Reset password?
            </Link>
          }
        />

        {requiresOtp && (
          <NeoField
            id="staff-otp"
            label="6-digit security code"
            inputMode="numeric"
            maxLength={6}
            mono
            placeholder="6-digit security OTP"
            value={otp}
            onChange={(val) => setOtp(val.replace(/\D/g, ""))}
            valid={otp.length === 6}
            statusText={`${otp.length}/6`}
          />
        )}

        {error && <Toast tone="critical">{error}</Toast>}

        <button type="submit" disabled={loading} className="voy-submit staff" style={{ marginTop: 4 }}>
          {loading ? "Authenticating…" : requiresOtp ? "Verify & enter" : "Enter console"}
        </button>
      </form>

      <div className="voy-foot">
        Have a staff invite? <Link href="/set-password">Activate account</Link>
        {" · "}
        <Link href="/login" style={{ color: "#3D6356" }}>Citizen login</Link>
      </div>
    </AuthShell>
  );
}
