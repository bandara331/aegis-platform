"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Toast } from "@/components/ui";
import { AuthShell, NeoField, PasswordField } from "@/components/auth/AuthShell";

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
      asideTitle="Set a new password"
      formTitle={
        <>
          Set a strong
          <br />
          new password
        </>
      }
      formSubtitle="Confirm your 6-digit code and pick a new password."
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 11 }}>
        <NeoField
          id="rp-email"
          label="Email"
          type="email"
          inputMode="email"
          placeholder="Email"
          value={email}
          onChange={setEmail}
        />
        <NeoField
          id="rp-otp"
          label="6-digit OTP"
          inputMode="numeric"
          maxLength={6}
          mono
          placeholder="6-digit reset OTP"
          value={otp}
          onChange={(val) => setOtp(val.replace(/\D/g, ""))}
          valid={otp.length === 6}
          statusText={otp.length > 0 ? `${otp.length}/6` : undefined}
        />
        <PasswordField
          id="rp-pass"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          minLength={8}
          placeholder="New password"
          autoComplete="new-password"
          showRules
        />
        {error && <Toast tone="critical">{error}</Toast>}
        <button type="submit" disabled={loading} className="voy-submit" style={{ marginTop: 4 }}>
          {loading ? "Updating…" : "Confirm password"}
        </button>
      </form>

      <div className="voy-foot">
        <Link href="/login">Back to sign in</Link>
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
