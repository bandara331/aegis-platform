"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "./Button";

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(10, 12, 16, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="bento-card"
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "var(--bg-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>{title}</h2>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

/**
 * Listens for HTTP 401 session-expired events and displays a re-authentication modal.
 */
export function SessionExpiredModal({ loginHref = "/login" }: { loginHref?: string }) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    function handleUnauthorized() {
      setExpired(true);
    }
    window.addEventListener("aegis:session-expired", handleUnauthorized);
    return () => window.removeEventListener("aegis:session-expired", handleUnauthorized);
  }, []);

  return (
    <Modal open={expired} title="Session expired (HTTP 401)">
      <p style={{ margin: "0 0 20px", fontSize: "14px", color: "var(--muted)" }}>
        Your 15-minute access token has expired. Please sign in again to continue securely.
      </p>
      <Link href={loginHref} style={{ textDecoration: "none" }}>
        <Button fullWidth>Sign in again</Button>
      </Link>
    </Modal>
  );
}
