import Link from "next/link";
import type { Metadata } from "next";
import { Button, Card, Tag } from "@/components/ui";

export const metadata: Metadata = { title: "403 Access Restricted — AEGIS" };

export default function PermissionDeniedPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "var(--bg-canvas)" }}>
      <Card style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}>
        <div style={{ marginBottom: "12px" }}>
          <Tag tone="critical">HTTP 403 · ROLE GUARD</Tag>
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: "26px", fontWeight: 800 }}>
          Insufficient role permissions
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: "14px", color: "var(--muted)" }}>
          Citizen accounts are restricted to the Citizen area (`/request`, `/my-requests`, `/assistant`, `/profile`), while Staff roles operate inside `/admin`.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login" style={{ textDecoration: "none" }}>
            <Button variant="secondary">Citizen Sign-In</Button>
          </Link>
          <Link href="/staff/login" style={{ textDecoration: "none" }}>
            <Button variant="primary">Staff Sign-In</Button>
          </Link>
          <Link href="/" style={{ textDecoration: "none" }}>
            <Button variant="ghost">Home</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
