"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Tag, Toast } from "@/components/ui";

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
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <Card style={{ borderRadius: 36, padding: "30px 24px" }}>
        <div style={{ marginBottom: 12 }}>
          <Tag tone="accent">STEP 1 · REGISTER</Tag>
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 600, letterSpacing: "-.03em" }}>Create account</h1>
        <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--muted)", lineHeight: 1.45 }}>
          Takes under a minute. Only what we need to reach you. Your NIC is encrypted and shown masked.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <label className="bento-label" htmlFor="reg-name">Full name</label>
            <input id="reg-name" type="text" required className="bento-input" placeholder="As on your NIC" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <label className="bento-label" htmlFor="reg-nic">NIC number</label>
            <input id="reg-nic" type="text" required className="bento-input" placeholder="200012345678 or 901234567V" value={nic} onChange={(e) => setNic(e.target.value)} />
          </div>
          <div>
            <label className="bento-label" htmlFor="reg-mobile">Mobile</label>
            <input id="reg-mobile" type="tel" required className="bento-input" placeholder="07X XXX XXXX" value={mobile} onChange={(e) => setMobile(e.target.value)} autoComplete="tel" />
          </div>
          <div>
            <label className="bento-label" htmlFor="reg-email">Email</label>
            <input id="reg-email" type="email" required className="bento-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label className="bento-label" htmlFor="reg-pass">Password</label>
            <input id="reg-pass" type="password" required minLength={8} className="bento-input" placeholder="At least 8 characters, with a digit" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>

          <div className="seg" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l.code} type="button" aria-pressed={language === l.code} onClick={() => setLanguage(l.code)}>
                {l.label}
              </button>
            ))}
          </div>

          <label className="chk">
            <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} />
            <i aria-hidden="true">{consentGiven ? "✓" : ""}</i>
            <span>I agree to my details being used to coordinate relief.</span>
          </label>

          {error && <Toast tone="critical">{error}</Toast>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Sending code…" : "Create account"}
          </Button>
        </form>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-card)", fontSize: 13, color: "var(--muted)" }}>
          Already registered?{" "}
          <Link href="/login" style={{ color: "var(--teal)", textDecoration: "none", fontWeight: 600 }}>Sign in →</Link>
        </div>
      </Card>
    </div>
  );
}
