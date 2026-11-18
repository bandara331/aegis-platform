"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Tag, Toast } from "@/components/ui";

export default function CitizenLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (String(data.error || "").includes("EMAIL_NOT_VERIFIED")) {
          router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
          return;
        }
        setError(data.error || "Invalid email or password.");
        setLoading(false);
        return;
      }

      router.push("/request");
      router.refresh();
    } catch {
      setError("Network error while signing in.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <Card style={{ borderRadius: 36, padding: "30px 24px" }}>
        <div style={{ marginBottom: 12 }}>
          <Tag tone="accent">CITIZEN SIGN IN</Tag>
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 600, letterSpacing: "-.03em" }}>Welcome back</h1>
        <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--muted)" }}>
          Request help and follow your cases.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label className="bento-label" htmlFor="citizen-email">Email</label>
            <input id="citizen-email" type="email" required className="bento-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="bento-label" htmlFor="citizen-password">Password</label>
              <Link href="/forgot-password" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none", fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
            <input id="citizen-password" type="password" required className="bento-input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>

          {error && <Toast tone="critical">{error}</Toast>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-card)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <Link href="/register" style={{ color: "var(--teal)", textDecoration: "none", fontWeight: 600 }}>Create account</Link>
          <Link href="/staff/login" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>Staff sign in →</Link>
        </div>
      </Card>
    </div>
  );
}
