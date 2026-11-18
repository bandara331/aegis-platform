"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui";
import { AuthShell, NeoField, PasswordField } from "@/components/auth/AuthShell";

export default function CitizenLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
      asideTitle="Welcome back, citizen"
      formTitle={
        <>
          Direct line to
          <br />
          emergency relief
        </>
      }
      activeTab="login"
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 11 }}>
        <NeoField
          id="citizen-email"
          label="Email"
          type="email"
          inputMode="email"
          placeholder="Email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          valid={email.trim().length > 0 ? emailValid : undefined}
          statusText={email.trim().length > 0 && emailValid ? "✓" : undefined}
        />

        <PasswordField
          id="citizen-password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Password"
          autoComplete="current-password"
          rightAction={
            <Link
              href="/forgot-password"
              style={{ fontSize: 11, color: "#3D6356", textDecoration: "none", fontWeight: 600 }}
            >
              Forgot password?
            </Link>
          }
        />

        {error && <Toast tone="critical">{error}</Toast>}

        <button type="submit" disabled={loading} className="voy-submit" style={{ marginTop: 4 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="voy-foot">
        Don&apos;t have an account?{" "}
        <Link href="/register">Create account</Link>
        {" · "}
        <Link href="/staff/login" style={{ color: "#3D6356" }}>Staff</Link>
      </div>
    </AuthShell>
  );
}
