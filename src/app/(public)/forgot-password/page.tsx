"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Toast } from "@/components/ui";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Cooldown active.");
        setLoading(false);
        return;
      }
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      theme="citizen"
      badge="PASSWORD RECOVERY"
      asideTitle="Recover your account."
      asideLead="Enter your registered email address and we will send a 6-digit password reset code."
      trustItems={[
        {
          icon: "shield",
          title: "Verified reset OTP",
          detail: "Only the account owner with inbox access can reset the password.",
        },
        {
          icon: "bell",
          title: "10-minute code window",
          detail: "Codes expire after 10 minutes for account safety.",
        },
      ]}
    >
      <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
        Reset your password
      </h1>
      <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--muted)" }}>
        Works for both Citizen and Staff accounts.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div>
          <label className="bento-label" htmlFor="fp-email">Email address</label>
          <input
            id="fp-email"
            type="email"
            required
            className="bento-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        {error && <Toast tone="critical">{error}</Toast>}
        <Button type="submit" fullWidth pill disabled={loading} style={{ minHeight: 50 }}>
          {loading ? "Sending OTP…" : "Send reset code →"}
        </Button>
      </form>

      <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border-card)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <Link href="/login" style={{ color: "var(--teal)", textDecoration: "none", fontWeight: 600 }}>
          ← Citizen sign in
        </Link>
        <Link href="/staff/login" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>
          Staff sign in →
        </Link>
      </div>
    </AuthShell>
  );
}
