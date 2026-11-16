"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Tag, Toast } from "@/components/ui";

function SetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: token.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid or expired invitation link.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "460px", margin: "24px auto" }}>
      <Card>
        <div style={{ marginBottom: "12px" }}>
          <Tag tone="accent">STAFF INVITATION · 24H ONE-TIME TOKEN</Tag>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 700 }}>Activate staff account</h1>
        <p style={{ margin: "0 0 18px", fontSize: "14px", color: "var(--muted)" }}>
          Complete your one-time staff invitation by setting your password.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          <div>
            <label className="bento-label" htmlFor="inv-email">INVITED EMAIL</label>
            <input id="inv-email" type="email" required className="bento-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="bento-label" htmlFor="inv-token">ONE-TIME TOKEN</label>
            <input id="inv-token" type="text" required className="bento-input mono" value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <label className="bento-label" htmlFor="inv-pass">PASSWORD (MIN 8 CHARS + DIGIT)</label>
            <input id="inv-pass" type="password" required minLength={8} className="bento-input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <Toast tone="critical">{error}</Toast>}
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Activating…" : "Activate Account & Enter Admin"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: "460px", margin: "24px auto" }} />}>
      <SetPasswordInner />
    </Suspense>
  );
}
