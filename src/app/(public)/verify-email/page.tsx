"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Tag, Toast } from "@/components/ui";

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
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
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
      setInfo("A new 6-digit verification code has been queued.");
    } catch {
      setError("Failed to resend OTP.");
    }
  }

  return (
    <div style={{ maxWidth: "460px", margin: "24px auto" }}>
      <Card>
        <div style={{ marginBottom: "12px" }}>
          <Tag tone="accent">EMAIL OTP VERIFICATION</Tag>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 700 }}>Enter 6-digit verification code</h1>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--muted)" }}>
          Codes expire in 10 minutes and allow at most 5 verification attempts.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label className="bento-label" htmlFor="verify-email-input">EMAIL ADDRESS</label>
            <input
              id="verify-email-input"
              type="email"
              required
              className="bento-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <span className="bento-label">6-DIGIT OTP</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px" }}>
              {digits.map((d, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputsRef.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`Digit ${idx + 1}`}
                  value={d}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className="bento-input mono"
                  style={{ height: "52px", textAlign: "center", fontSize: "20px", fontWeight: 700, padding: 0 }}
                />
              ))}
            </div>
          </div>

          {error && <Toast tone="critical">{error}</Toast>}
          {info && <Toast tone="success">{info}</Toast>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Verifying…" : "Verify Email & Continue"}
          </Button>
        </form>

        <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border-card)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
          <Button variant="ghost" type="button" disabled={cooldown > 0} onClick={handleResend}>
            {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend 6-digit OTP"}
          </Button>
          <Link href="/login" style={{ color: "var(--muted)", textDecoration: "none" }}>
            Back to login
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: "460px", margin: "24px auto" }} />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
