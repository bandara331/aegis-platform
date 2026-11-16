"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, PageHeader, Tag } from "@/components/ui";
import { getDictionary, type SupportedLocale } from "@/lib/i18n/dictionary";

export default function CitizenProfilePage() {
  const router = useRouter();
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const dict = getDictionary(locale);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <PageHeader
        eyebrow="CITIZEN PROFILE"
        eyebrowTone="accent"
        title={dict.nav.profile}
        subtitle="Manage your preferred UI language and encrypted identity settings."
      />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>National Identity Card (NIC)</span>
          <Tag tone="success">AES-256-GCM ENCRYPTED</Tag>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: "13px", color: "var(--muted)" }}>
          Your NIC is stored encrypted in PostgreSQL (`aegis.users.nic_ciphertext`) with an HMAC-SHA256 uniqueness index and is masked across all screens.
        </p>

        <div style={{ marginBottom: "20px" }}>
          <label className="bento-label" htmlFor="profile-lang">INTERFACE LANGUAGE (i18n)</label>
          <select
            id="profile-lang"
            className="bento-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as SupportedLocale)}
          >
            <option value="en">English (EN)</option>
            <option value="si">සිංහල (SI)</option>
            <option value="ta">தமிழ் (TA)</option>
          </select>
        </div>

        <Button variant="danger" onClick={handleSignOut}>
          {dict.nav.signOut}
        </Button>
      </Card>
    </div>
  );
}
