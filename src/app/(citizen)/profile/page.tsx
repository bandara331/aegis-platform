"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorState, PageHeader, Skeleton, Tag, Toast } from "@/components/ui";
import { getDictionary, type SupportedLocale } from "@/lib/i18n/dictionary";

interface AccountProfile {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  maskedNic?: string | null;
  preferredLanguage: string;
  emailConfirmed: boolean;
  createdAt: string;
}

const MOBILE_REGEX = /^(?:\+94|0)7[0-9]{8}$/;

const LANG_OPTIONS: { code: SupportedLocale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
];

export default function CitizenProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const dict = getDictionary(locale);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/account/me", { cache: "no-store" });
        if (!res.ok) {
          setError(`Unable to load account details (HTTP ${res.status}).`);
          return;
        }
        const data = (await res.json()) as AccountProfile;
        setProfile(data);
        setFullName(data.fullName || "");
        setPhoneNumber(data.phoneNumber || "");
        if (data.preferredLanguage === "si" || data.preferredLanguage === "ta" || data.preferredLanguage === "en") {
          setLocale(data.preferredLanguage);
        }
      } catch {
        setError("Unable to reach account service.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (phoneNumber.trim() && !MOBILE_REGEX.test(phoneNumber.trim())) {
      setMsg({ text: "Invalid Sri Lankan mobile number (use 07XXXXXXXX or +947XXXXXXXX).", error: true });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/account/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          preferredLanguage: locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ text: data.error || "Could not update account.", error: true });
      } else {
        setProfile((p) => (p ? { ...p, ...data } : data));
        setMsg({ text: "Account details saved and recorded." });
        router.refresh();
      }
    } catch {
      setMsg({ text: "Network error while saving profile.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <PageHeader
        eyebrow="CITIZEN ACCOUNT"
        eyebrowTone="accent"
        title={dict.nav.profile}
        subtitle="View your verified identity details, edit contact preferences, or sign out."
      />

      {loading ? (
        <Skeleton height={260} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="cit-profile-grid">
          {/* Left Column: Deep Forest Citizen Identity Pass + Session Sign-Out */}
          <div style={{ display: "grid", gap: "18px" }}>
            <div className="cit-id-pass">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>Account identity</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Tag tone="success">{profile?.emailConfirmed ? "EMAIL VERIFIED" : "UNVERIFIED"}</Tag>
                  <Tag tone="accent">AES-256-GCM NIC</Tag>
                </div>
              </div>

              <div className="kv">
                <span>Email address</span>
                <b className="mono">{profile?.email || "—"}</b>
              </div>
              <div className="kv">
                <span>NIC (masked)</span>
                <b className="mono">{profile?.maskedNic || "Encrypted on file"}</b>
              </div>
              <div className="kv">
                <span>Member since</span>
                <b className="mono">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}</b>
              </div>
            </div>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <b style={{ display: "block", fontSize: 15 }}>Session security</b>
                  <span className="muted" style={{ fontSize: 13 }}>
                    Sign out of this device and clear your session cookie.
                  </span>
                </div>
                <Button variant="danger" onClick={handleSignOut}>
                  {dict.nav.signOut}
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column: Edit Account Details Card */}
          <Card>
            <h2 style={{ margin: "0 0 16px", fontSize: 19, fontWeight: 800 }}>Edit account details</h2>
            <form onSubmit={handleSave} style={{ display: "grid", gap: 15 }}>
              <div>
                <label className="bento-label" htmlFor="prof-name">Full name</label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  className="bento-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="bento-label" htmlFor="prof-mobile">Mobile number</label>
                <input
                  id="prof-mobile"
                  type="tel"
                  required
                  className="bento-input mono"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="07XXXXXXXX"
                />
              </div>
              <div>
                <span className="bento-label" style={{ marginBottom: 6 }}>Preferred language (i18n)</span>
                <div className="voy-lang-seg" role="group" aria-label="Preferred language">
                  {LANG_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      className={locale === opt.code ? "on" : undefined}
                      aria-pressed={locale === opt.code}
                      onClick={() => setLocale(opt.code)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {msg && <Toast tone={msg.error ? "critical" : "success"}>{msg.text}</Toast>}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save account changes"}
                </Button>
                <Link href="/forgot-password" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
                  Change / reset password
                </Link>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
