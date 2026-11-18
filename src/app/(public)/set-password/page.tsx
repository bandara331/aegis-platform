"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Toast } from "@/components/ui";
import { AuthShell, NeoField, PasswordField } from "@/components/auth/AuthShell";

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

  return (
    <AuthShell
      theme="staff"
      asideTitle="Activate staff account"
      formTitle={
        <>
          Activate your
          <br />
          staff account
        </>
      }
      formSubtitle="Confirm your invite email, token, and set a password."
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 11 }}>
        <NeoField
          id="inv-email"
          label="Invited work email"
          type="email"
          inputMode="email"
          placeholder="Invited work email"
          value={email}
          onChange={setEmail}
        />
        <NeoField
          id="inv-token"
          label="Invitation token"
          mono
          placeholder="One-time invitation token"
          value={token}
          onChange={setToken}
        />
        <PasswordField
          id="inv-pass"
          label="Password"
          value={password}
          onChange={setPassword}
          minLength={8}
          placeholder="Password"
          autoComplete="new-password"
          showRules
        />
        {error && <Toast tone="critical">{error}</Toast>}
        <button type="submit" disabled={loading} className="voy-submit staff" style={{ marginTop: 4 }}>
          {loading ? "Activating…" : "Activate & enter"}
        </button>
      </form>

      <div className="voy-foot">
        <Link href="/staff/login">Back to staff sign in</Link>
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
