"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Toast } from "@/components/ui";
import { AuthShell, PasswordField } from "@/components/auth/AuthShell";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Password reset failed.");
        setLoading(false);
        return;
      }
      router.push("/login");
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      theme="citizen"
      badge="OTP PASSWORD RESET"
      asideTitle="Set a strong new password."
      asideLead="Enter the 6-digit code from your email and choose a new password with at least 8 characters and 1 number."
      trustItems={[
        {
          icon: "check",
          title: "Instant update",
          detail: "You can sign in immediately after confirming your new password.",
        },
        {
          icon: "shield",
          title: "Audited security event",
          detail: "Password resets are logged in the security audit trail.",
        },
      ]}
    >
      <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
        Set a new password
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted)" }}>
        Confirm your 6-digit code and enter your new password.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <div>
          <label className="bento-label" htmlFor="rp-email">Email address</label>
          <input
            id="rp-email"
            type="email"
            required
            className="bento-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="bento-label" htmlFor="rp-otp">6-digit reset OTP</label>
          <input
            id="rp-otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            className="bento-input mono"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <PasswordField
          id="rp-pass"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          minLength={8}
          placeholder="Minimum 8 characters with a number"
          autoComplete="new-password"
          showRules
        />
        {error && <Toast tone="critical">{error}</Toast>}
        <Button type="submit" fullWidth pill disabled={loading} style={{ minHeight: 50 }}>
          {loading ? "Updating…" : "Confirm new password →"}
        </Button>
      </form>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-card)", fontSize: 13 }}>
        <Link href="/login" style={{ color: "var(--teal)", textDecoration: "none", fontWeight: 600 }}>
          ← Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 460, margin: "24px auto" }} />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
