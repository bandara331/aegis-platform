"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Toast } from "@/components/ui";
import { AuthShell, PasswordField } from "@/components/auth/AuthShell";

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
    <AuthShell
      theme="citizen"
      badge="CITIZEN PORTAL"
      asideTitle="Direct line to emergency relief."
      asideLead="Sign in to submit an assistance request, track every status step, and chat directly with verified field coordinators."
      activeTab="login"
      trustItems={[
        {
          icon: "shield",
          title: "Protected identity",
          detail: "Your NIC is encrypted at rest and displayed masked to staff.",
        },
        {
          icon: "chat",
          title: "Live coordinator chat",
          detail: "Two-way updates and system dispatch notices in your dashboard.",
        },
        {
          icon: "sparkle",
          title: "Multilingual AI guidance",
          detail: "Preparedness checklists in English, සිංහල, and தமிழ்.",
        },
      ]}
      footerNote="Need urgent help right now? Sign in or create an account in under a minute."
    >
      <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
        Welcome back
      </h1>
      <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--muted)" }}>
        Sign in with your registered email and password.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div>
          <label className="bento-label" htmlFor="citizen-email">Email address</label>
          <input
            id="citizen-email"
            type="email"
            required
            className="bento-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <PasswordField
          id="citizen-password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          autoComplete="current-password"
          rightAction={
            <Link
              href="/forgot-password"
              style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none", fontWeight: 600 }}
            >
              Forgot password?
            </Link>
          }
        />

        {error && <Toast tone="critical">{error}</Toast>}

        <Button type="submit" fullWidth pill disabled={loading} style={{ minHeight: 50, marginTop: 4 }}>
          {loading ? "Signing in…" : "Sign in to Citizen Portal →"}
        </Button>
      </form>

      <div
        style={{
          marginTop: 22,
          paddingTop: 16,
          borderTop: "1px solid var(--border-card)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 13,
        }}
      >
        <span className="muted">
          New to AEGIS?{" "}
          <Link href="/register" style={{ color: "var(--teal)", textDecoration: "none", fontWeight: 700 }}>
            Create account
          </Link>
        </span>
        <Link href="/staff/login" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>
          Staff sign in →
        </Link>
      </div>
    </AuthShell>
  );
}
