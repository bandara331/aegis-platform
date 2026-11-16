"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Tag, Toast } from "@/components/ui";

const NIC_REGEX = /^(?:[0-9]{9}[vVxX]|[0-9]{12})$/;
const MOBILE_REGEX = /^(?:\+94|0)7[0-9]{8}$/;

export default function CitizenRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [nic, setNic] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("en");
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!NIC_REGEX.test(nic.trim())) {
      setError("Invalid Sri Lankan NIC (use 9 digits + V/X or 12 digits).");
      return;
    }

    if (!MOBILE_REGEX.test(mobile.trim())) {
      setError("Invalid Sri Lankan mobile number (use 07XXXXXXXX or +947XXXXXXXX).");
      return;
    }

    if (!consentGiven) {
      setError("Please accept the personal data consent checkbox.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          nic: nic.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          password,
          language,
          consentGiven,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed.");
        setLoading(false);
        return;
      }

      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch {
      setError("Network error while registering.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "480px", margin: "16px auto" }}>
      <Card>
        <div style={{ marginBottom: "12px" }}>
          <Tag tone="accent">MINIMAL CITIZEN REGISTRATION</Tag>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 700 }}>Create citizen account</h1>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--muted)" }}>
          Your NIC is encrypted with AES-256-GCM, masked on screen, and never sent to any AI service.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="bento-label" htmlFor="reg-name">FULL NAME</label>
            <input
              id="reg-name"
              type="text"
              required
              className="bento-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="bento-label" htmlFor="reg-nic">SRI LANKAN NIC</label>
              <input
                id="reg-nic"
                type="text"
                required
                className="bento-input"
                placeholder="9 digits+V/X or 12 digits"
                value={nic}
                onChange={(e) => setNic(e.target.value)}
              />
            </div>
            <div>
              <label className="bento-label" htmlFor="reg-mobile">MOBILE NUMBER</label>
              <input
                id="reg-mobile"
                type="tel"
                required
                className="bento-input"
                placeholder="07XXXXXXXX"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: "12px" }}>
            <div>
              <label className="bento-label" htmlFor="reg-email">EMAIL ADDRESS</label>
              <input
                id="reg-email"
                type="email"
                required
                className="bento-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="bento-label" htmlFor="reg-lang">LANGUAGE</label>
              <select
                id="reg-lang"
                className="bento-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="si">සිංහල</option>
                <option value="ta">தமிழ்</option>
              </select>
            </div>
          </div>

          <div>
            <label className="bento-label" htmlFor="reg-pass">PASSWORD (MIN 8 CHARS + DIGIT)</label>
            <input
              id="reg-pass"
              type="password"
              required
              minLength={8}
              className="bento-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", color: "var(--muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              style={{ marginTop: "3px", width: "18px", height: "18px", accentColor: "var(--accent)" }}
            />
            <span>
              I consent to the encrypted storage of my personal data (NIC, mobile, email) strictly for humanitarian aid verification and coordination.
            </span>
          </label>

          {error && <Toast tone="critical">{error}</Toast>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Sending 6-digit OTP…" : "Register & Verify Email"}
          </Button>
        </form>

        <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border-card)", fontSize: "13px", color: "var(--muted)" }}>
          Already registered?{" "}
          <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
            Sign in →
          </Link>
        </div>
      </Card>
    </div>
  );
}
