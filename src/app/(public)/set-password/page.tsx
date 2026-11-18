"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Toast } from "@/components/ui";
import { AuthShell, PasswordField } from "@/components/auth/AuthShell";

function SetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: token.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid or expired invitation link.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error.");
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
      badge="STAFF INVITATION · 24H TOKEN"
      asideTitle="Activate your staff account."
      asideLead="Complete your one-time invitation from the System Administrator by choosing your password."
      trustItems={[
        {
          icon: "shield",
          title: "Single-use invite token",
          detail: "Invitation tokens expire after 24 hours and can only be used once.",
        },
        {
          icon: "people",
          title: "Role pre-assigned",
          detail: "Your coordinator or officer permissions are activated immediately.",
        },
      ]}
    >
      <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#fff" }}>
        Activate staff account
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "#A9B4DA" }}>
        Confirm your invited work email, token, and set your password.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <div>
          <label className="bento-label" style={darkLabel} htmlFor="inv-email">Invited work email</label>
          <input
            id="inv-email"
            type="email"
            required
            className="bento-input"
            style={darkInput}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="bento-label" style={darkLabel} htmlFor="inv-token">One-time invitation token</label>
          <input
            id="inv-token"
            type="text"
            required
            className="bento-input mono"
            style={darkInput}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <PasswordField
          id="inv-pass"
          label="Password"
          value={password}
          onChange={setPassword}
          minLength={8}
          placeholder="Minimum 8 characters with a number"
          autoComplete="new-password"
          dark
          showRules
        />
        {error && <Toast tone="critical">{error}</Toast>}
        <Button type="submit" variant="cta" fullWidth pill disabled={loading} style={{ minHeight: 52 }}>
          {loading ? "Activating…" : "Activate account & enter console →"}
        </Button>
      </form>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #263168", fontSize: 13 }}>
        <Link href="/staff/login" style={{ color: "#DCE2F7", textDecoration: "none", fontWeight: 600 }}>
          ← Back to staff sign in
        </Link>
      </div>
    </AuthShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 460, margin: "24px auto" }} />}>
      <SetPasswordInner />
    </Suspense>
  );
}
