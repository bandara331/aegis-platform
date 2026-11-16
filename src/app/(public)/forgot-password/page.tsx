"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Tag, Toast } from "@/components/ui";

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
    <div style={{ maxWidth: "440px", margin: "24px auto" }}>
      <Card>
        <div style={{ marginBottom: "12px" }}>
          <Tag tone="warning">PASSWORD RECOVERY</Tag>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 700 }}>Reset your password</h1>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--muted)" }}>
          Enter your email to receive a 6-digit password reset OTP.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="bento-label" htmlFor="fp-email">EMAIL ADDRESS</label>
            <input
              id="fp-email"
              type="email"
              required
              className="bento-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <Toast tone="critical">{error}</Toast>}
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Sending OTP…" : "Send Reset OTP"}
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
