"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Toast } from "@/components/ui";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, otp: requiresOtp ? otp.trim() : undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Staff authentication failed.");
        setLoading(false);
        return;
      }
      if (res.status === 202 || data.requiresOtp) {
        setRequiresOtp(true);
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error while authenticating staff account.");
      setLoading(false);
    }
  }

  // Visually distinct from the citizen forms: navy card on the tinted canvas.
  const darkInput: React.CSSProperties = { background: "#161D45", borderColor: "#2A3366", color: "#fff" };
  const darkLabel: React.CSSProperties = { color: "#B7BDDA" };

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <div style={{ background: "var(--ink)", color: "#fff", borderRadius: 36, padding: "32px 26px", position: "relative", overflow: "hidden", animation: "up .6s both" }}>
        <i aria-hidden="true" style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", background: "var(--coral)", opacity: 0.9, right: -80, bottom: -90 }} />
        <div style={{ position: "relative" }}>
          <span className="mono" style={{ display: "inline-block", fontSize: 12, letterSpacing: ".08em", background: "var(--sun)", color: "var(--ink)", borderRadius: 999, padding: "6px 12px", fontWeight: 500, marginBottom: 14 }}>
            STAFF PORTAL
          </span>
          <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 600, letterSpacing: "-.03em" }}>Staff sign in</h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "#B7BDDA" }}>
            For coordinators, case managers, logistics, shelter, volunteer, donor and partner officers, and administrators.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            <div>
              <label className="bento-label" style={darkLabel} htmlFor="staff-email">Work email</label>
              <input id="staff-email" type="email" required className="bento-input" style={darkInput} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className="bento-label" style={darkLabel} htmlFor="staff-pass">Password</label>
              <input id="staff-pass" type="password" required className="bento-input" style={darkInput} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {requiresOtp && (
              <div>
                <label className="bento-label" style={darkLabel} htmlFor="staff-otp">6-digit email code</label>
                <input id="staff-otp" type="text" inputMode="numeric" maxLength={6} required className="bento-input mono" style={darkInput} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
              </div>
            )}

            {error && <Toast tone="critical">{error}</Toast>}

            <Button type="submit" variant="cta" fullWidth pill disabled={loading} style={{ minHeight: 52 }}>
              {loading ? "Checking…" : requiresOtp ? "Verify code and enter" : "Enter staff area"}
            </Button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #2A3366", display: "flex", justifyContent: "space-between", fontSize: 13, color: "#B7BDDA" }}>
            <Link href="/forgot-password" style={{ color: "#B7BDDA" }}>Reset password</Link>
            <Link href="/login" style={{ color: "#fff", fontWeight: 600, textDecoration: "none" }}>Citizen sign in →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
