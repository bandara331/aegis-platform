"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Tag, Toast } from "@/components/ui";

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
    <div style={{ maxWidth: "440px", margin: "24px auto" }}>
      <Card>
        <div style={{ marginBottom: "12px" }}>
          <Tag tone="warning">OTP PASSWORD RESET</Tag>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 700 }}>Set a new password</h1>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px", marginTop: "16px" }}>
          <div>
            <label className="bento-label" htmlFor="rp-email">EMAIL ADDRESS</label>
            <input id="rp-email" type="email" required className="bento-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="bento-label" htmlFor="rp-otp">6-DIGIT OTP</label>
            <input id="rp-otp" type="text" inputMode="numeric" maxLength={6} required className="bento-input mono" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className="bento-label" htmlFor="rp-pass">NEW PASSWORD (MIN 8 CHARS + DIGIT)</label>
            <input id="rp-pass" type="password" required minLength={8} className="bento-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          {error && <Toast tone="critical">{error}</Toast>}
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Updating…" : "Confirm New Password"}
          </Button>
        </form>
        <div style={{ marginTop: "16px", fontSize: "13px" }}>
          <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
            ← Back to sign-in
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: "440px", margin: "24px auto" }} />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
