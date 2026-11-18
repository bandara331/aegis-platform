"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Toast } from "@/components/ui";
import { AuthShell, PasswordField } from "@/components/auth/AuthShell";

const NIC_REGEX = /^(?:[0-9]{9}[vVxX]|[0-9]{12})$/;
const MOBILE_REGEX = /^(?:\+94|0)7[0-9]{8}$/;

const LANGS = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
];

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

  const nicValid = nic.trim().length > 0 && NIC_REGEX.test(nic.trim());
  const mobileValid = mobile.trim().length > 0 && MOBILE_REGEX.test(mobile.trim());

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
    <AuthShell
      theme="citizen"
      badge="STEP 1 OF 2 · REGISTER"
      asideTitle="Create your citizen account."
      asideLead="Takes under a minute. We only collect what emergency teams need to verify your identity and reach you quickly."
      activeTab="register"
      trustItems={[
        {
          icon: "shield",
          title: "NIC encrypted & masked",
          detail: "Stored with HMAC deduplication; staff only see a masked number.",
        },
        {
          icon: "bell",
          title: "Email OTP + live alerts",
          detail: "6-digit verification code sent immediately to your inbox.",
        },
        {
          icon: "pin",
          title: "GPS-ready relief requests",
          detail: "Share your exact location in 3 simple steps once verified.",
        },
      ]}
      footerNote="Already have a verified account? Switch to Citizen sign in above."
    >
      <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
        Create account
      </h1>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--muted)" }}>
        Fill in your details below to receive your 6-digit verification code.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 13 }}>
        <div>
          <label className="bento-label" htmlFor="reg-name">Full name (as on NIC)</label>
          <input
            id="reg-name"
            type="text"
            required
            className="bento-input"
            placeholder="e.g. Kasun Perera"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div className="auth-two-col">
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="bento-label" htmlFor="reg-nic">NIC number</label>
              {nic.trim().length > 0 && (
                <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: nicValid ? "#086548" : "#9F1E16" }}>
                  {nicValid ? "Valid NIC" : "9+V or 12 digits"}
                </span>
              )}
            </div>
            <input
              id="reg-nic"
              type="text"
              required
              className="bento-input mono"
              placeholder="200012345678 or 901234567V"
              value={nic}
              onChange={(e) => setNic(e.target.value)}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="bento-label" htmlFor="reg-mobile">Mobile number</label>
              {mobile.trim().length > 0 && (
                <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: mobileValid ? "#086548" : "#9F1E16" }}>
                  {mobileValid ? "Valid" : "07XXXXXXXX"}
                </span>
              )}
            </div>
            <input
              id="reg-mobile"
              type="tel"
              required
              className="bento-input mono"
              placeholder="07X XXX XXXX"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              autoComplete="tel"
            />
          </div>
        </div>

        <div>
          <label className="bento-label" htmlFor="reg-email">Email address</label>
          <input
            id="reg-email"
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
          id="reg-pass"
          label="Password"
          value={password}
          onChange={setPassword}
          minLength={8}
          placeholder="Minimum 8 characters with a number"
          autoComplete="new-password"
          showRules
        />

        <div>
          <span className="bento-label">Preferred language for emails &amp; alerts</span>
          <div className="seg" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                aria-pressed={language === l.code}
                onClick={() => setLanguage(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <label
          className="chk"
          style={{
            padding: "11px 13px",
            borderRadius: 16,
            background: consentGiven ? "var(--teal-tint)" : "var(--surface-soft)",
            border: `1px solid ${consentGiven ? "rgba(11, 122, 135, 0.25)" : "var(--border-card)"}`,
          }}
        >
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
          />
          <i aria-hidden="true">{consentGiven ? "✓" : ""}</i>
          <span>I consent to my contact and location details being used to coordinate emergency relief.</span>
        </label>

        {error && <Toast tone="critical">{error}</Toast>}

        <Button type="submit" variant="cta" fullWidth pill disabled={loading} style={{ minHeight: 50, marginTop: 2 }}>
          {loading ? "Creating account & sending code…" : "Create account & send verification code →"}
        </Button>
      </form>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-card)", fontSize: 13, color: "var(--muted)" }}>
        Already registered?{" "}
        <Link href="/login" style={{ color: "var(--teal)", textDecoration: "none", fontWeight: 700 }}>
          Sign in →
        </Link>
      </div>
    </AuthShell>
  );
}
