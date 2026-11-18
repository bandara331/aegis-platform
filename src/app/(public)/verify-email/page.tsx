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
      setInfo("A new 6-digit verification code has been queued.");
    } catch {
      setError("Failed to resend OTP.");
    }
  }

  const mm = String(Math.floor(cooldown / 60));
  const ss = String(cooldown % 60).padStart(2, "0");

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <Card style={{ borderRadius: 36, padding: "30px 24px" }}>
        <div style={{ marginBottom: 12 }}>
          <Tag tone="accent">STEP 2 · VERIFY</Tag>
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 600, letterSpacing: "-.03em" }}>Check your email</h1>
        <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--muted)", lineHeight: 1.45 }}>
          We sent a 6-digit code to your email address. It expires in 10 minutes.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label className="bento-label" htmlFor="verify-email-input">Email</label>
            <input id="verify-email-input" type="email" required className="bento-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="otp-row" role="group" aria-label="6-digit code">
            {digits.map((d, idx) => (
              <input
                key={idx}
                ref={(el) => { inputsRef.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                aria-label={`Digit ${idx + 1}`}
                className="mono"
                value={d}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
              />
            ))}
          </div>

          {error && <Toast tone="critical">{error}</Toast>}
          {info && <Toast tone="success">{info}</Toast>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Verifying…" : "Verify and continue"}
          </Button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", margin: "16px 0 0" }}>
          {cooldown > 0 ? (
            <>Resend code in <b style={{ color: "var(--ink)" }}>{mm}:{ss}</b></>
          ) : (
            <button type="button" onClick={handleResend} style={{ background: "none", border: 0, color: "var(--teal)", fontWeight: 600, cursor: "pointer", font: "inherit", minHeight: 44 }}>
              Resend code
            </button>
          )}
        </p>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
          Wrong email? <Link href="/register" style={{ color: "var(--teal)" }}>Change it</Link>
        </p>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 440, margin: "0 auto" }} />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
