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

      // Citizen login redirects strictly to /request
      router.push("/request");
      router.refresh();
    } catch {
      setError("Network error while signing in.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "440px", margin: "24px auto" }}>
      <Card>
        <div style={{ marginBottom: "12px" }}>
          <Tag tone="accent">CITIZEN PORTAL SIGN-IN</Tag>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 700 }}>Sign in to Citizen Portal</h1>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--muted)" }}>
          Submit emergency assistance requests and communicate with assigned coordinators.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="bento-label" htmlFor="citizen-email">EMAIL ADDRESS</label>
            <input
              id="citizen-email"
              type="email"
              required
              className="bento-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="bento-label" htmlFor="citizen-password">PASSWORD</label>
              <Link href="/forgot-password" style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="citizen-password"
              type="password"
              required
              className="bento-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <Toast tone="critical">{error}</Toast>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
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
          <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
            Create citizen account
          </Link>
          <Link href="/staff/login" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>
            Staff sign-in →
          </Link>
        </div>
      </Card>
    </div>
  );
}
