"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui";
import { AuthShell, NeoField, PasswordField } from "@/components/auth/AuthShell";

const NIC_REGEX = /^(?:[0-9]{9}[vVxX]|[0-9]{12})$/;
const MOBILE_REGEX = /^(?:\+94|0)7[0-9]{8}$/;

const LANGS = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
];

const DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

export default function CitizenRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [nic, setNic] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("en");
  const [district, setDistrict] = useState("");
  const [alertOptIn, setAlertOptIn] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nicValid = nic.trim().length > 0 && NIC_REGEX.test(nic.trim());
  const mobileValid = mobile.trim().length > 0 && MOBILE_REGEX.test(mobile.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
          alertOptIn,
          district: district || null,
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
      asideTitle="Create your citizen account"
      formTitle={
        <>
          Start your
          <br />
          relief profile
        </>
      }
      activeTab="register"
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 9 }}>
        <NeoField
          id="reg-name"
          label="Full name"
          placeholder="Full name (as on NIC)"
          value={fullName}
          onChange={setFullName}
          autoComplete="name"
        />

        <div className="voy-two-col">
          <NeoField
            id="reg-nic"
            label="NIC number"
            mono
            placeholder="NIC number"
            value={nic}
            onChange={setNic}
            valid={nic.trim().length > 0 ? nicValid : undefined}
            statusText={nic.trim().length > 0 ? (nicValid ? "✓" : "Invalid") : undefined}
          />

          <NeoField
            id="reg-mobile"
            label="Mobile"
            type="tel"
            inputMode="tel"
            mono
            placeholder="07X XXX XXXX"
            value={mobile}
            onChange={setMobile}
            autoComplete="tel"
            valid={mobile.trim().length > 0 ? mobileValid : undefined}
            statusText={mobile.trim().length > 0 ? (mobileValid ? "✓" : "07X") : undefined}
          />
        </div>

        <NeoField
          id="reg-email"
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
          id="reg-pass"
          label="Password"
          value={password}
          onChange={setPassword}
          minLength={8}
          placeholder="Password"
          autoComplete="new-password"
          showRules
        />

        <div className="voy-lang-seg" role="group" aria-label="Preferred language">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              className={language === l.code ? "on" : undefined}
              aria-pressed={language === l.code}
              onClick={() => setLanguage(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label htmlFor="reg-district" style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
            District (optional, for automated weather advisories)
          </label>
          <select
            id="reg-district"
            className="bento-select"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value="">Select district (optional)</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <label className={`voy-consent ${alertOptIn ? "on" : ""}`}>
          <input
            type="checkbox"
            checked={alertOptIn}
            onChange={(e) => setAlertOptIn(e.target.checked)}
          />
          <span className="voy-consent-dot" aria-hidden="true">
            {alertOptIn ? "✓" : ""}
          </span>
          <span>Email me automated weather advisories for my selected district (opt-in, unsubscribe anytime).</span>
        </label>

        <label className={`voy-consent ${consentGiven ? "on" : ""}`}>
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
          />
          <span className="voy-consent-dot" aria-hidden="true">
            {consentGiven ? "✓" : ""}
          </span>
          <span>I consent to emergency relief contact &amp; GPS coordination.</span>
        </label>

        {error && <Toast tone="critical">{error}</Toast>}

        <button type="submit" disabled={loading} className="voy-submit" style={{ marginTop: 2 }}>
          {loading ? "Creating account…" : "Start"}
        </button>
      </form>

      <div className="voy-foot">
        Already have an account? <Link href="/login">Log in</Link>
      </div>
    </AuthShell>
  );
}
