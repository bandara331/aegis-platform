"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui";
import { AuthShell, NeoField } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
      asideTitle="Reset password"
      formTitle={
        <>
          Recover your
          <br />
          account access
        </>
      }
      formSubtitle="Enter your registered email to receive a 6-digit code."
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <NeoField
          id="fp-email"
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
        {error && <Toast tone="critical">{error}</Toast>}
        <button type="submit" disabled={loading} className="voy-submit">
          {loading ? "Sending OTP…" : "Send reset code"}
        </button>
      </form>

      <div className="voy-foot">
        <Link href="/login">Citizen sign in</Link>
        {" · "}
        <Link href="/staff/login" style={{ color: "#3D6356" }}>Staff sign in</Link>
      </div>
    </AuthShell>
  );
}
