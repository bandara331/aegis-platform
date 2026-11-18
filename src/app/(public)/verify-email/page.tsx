"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Toast } from "@/components/ui";
import { AuthShell, NeoField } from "@/components/auth/AuthShell";

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function handleDigitChange(idx: number, val: string) {
    const clean = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    if (clean && idx < 5) inputsRef.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) inputsRef.current[idx - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputsRef.current[Math.min(5, pasted.length)]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const otp = digits.join("");
    if (otp.length !== 6) {
      setError("Enter all 6 digits of your verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed.");
        setLoading(false);
        return;
      }
      router.push("/request");
      router.refresh();
    } catch {
      setError("Network error while verifying OTP.");
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !email.trim()) return;
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), purpose: "VerifyEmail" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Cooldown active.");
        return;
      }
      setCooldown(data.resendCooldownSeconds || 60);
      setInfo("A new 6-digit verification code has been sent to your email.");
    } catch {
      setError("Failed to resend OTP.");
    }
  }

  const mm = String(Math.floor(cooldown / 60));
  const ss = String(cooldown % 60).padStart(2, "0");

  return (
    <AuthShell
      theme="citizen"
      asideTitle="Verify your email"
      formTitle={
        <>
          Check your
          <br />
          email code
        </>
      }
      formSubtitle="Enter the 6-digit code sent to your inbox."
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <NeoField
          id="verify-email-input"
          label="Email"
          type="email"
          inputMode="email"
          placeholder="Email"
          value={email}
          onChange={setEmail}
        />

        <div className="otp-row" role="group" aria-label="6-digit code">
          {digits.map((d, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputsRef.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className="mono"
              aria-label={`Digit ${idx + 1}`}
              value={d}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={idx === 0 ? handlePaste : undefined}
              style={{
                background: "#F1F3F4",
                borderColor: d ? "#3D6356" : "transparent",
                color: "#111827",
                borderRadius: 16,
              }}
            />
          ))}
        </div>

        {error && <Toast tone="critical">{error}</Toast>}
        {info && <Toast tone="success">{info}</Toast>}

        <button type="submit" disabled={loading} className="voy-submit" style={{ marginTop: 4 }}>
          {loading ? "Verifying…" : "Verify & continue"}
        </button>

        <div className="voy-foot" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            disabled={cooldown > 0}
            onClick={handleResend}
            style={{
              background: "none",
              border: 0,
              padding: 0,
              color: cooldown > 0 ? "#6B7280" : "#3D6356",
              fontWeight: 600,
              fontSize: 12,
              cursor: cooldown > 0 ? "default" : "pointer",
            }}
          >
            {cooldown > 0 ? `Resend in ${mm}:${ss}` : "Resend code"}
          </button>
          <Link href="/login">Back to sign in</Link>
        </div>
      </form>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 460, margin: "24px auto" }} />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
