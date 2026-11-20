"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/icons/Icon";
import { PublicSignOutButton } from "./PublicSignOutButton";

interface Props {
  isCitizen: boolean;
  isStaff: boolean;
}

export function PublicNav({ isCitizen, isStaff }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={`pub-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main">
      <div className="pub-nav-head">
        <Link href="/" className="pub-logo" onClick={() => setMenuOpen(false)}>
          <LogoMark />
          AEGIS
        </Link>

        <div className="pub-nav-mobile-actions">
          {!isCitizen && !isStaff && (
            <Link className="lbtn cor sm" href="/register" onClick={() => setMenuOpen(false)}>
              I need help
            </Link>
          )}
          <button
            type="button"
            className="pub-menu-btn"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      <div className={`pub-nav-links ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)}>
        <Link className="l" href="/">Home</Link>
        <Link className="l" href="/alerts">Alerts</Link>

        {isCitizen ? (
          <>
            <Link className="l" href="/request">Request help</Link>
            <Link className="l" href="/my-requests">My requests</Link>
            <Link className="l" href="/chat">Chat</Link>
            <Link className="l" href="/profile">Account</Link>
            <PublicSignOutButton redirectTo="/login" />
          </>
        ) : isStaff ? (
          <>
            <Link className="l" href="/admin">Admin console</Link>
            <Link className="l" href="/admin/chat">Staff chat</Link>
            <PublicSignOutButton redirectTo="/staff/login" />
          </>
        ) : (
          <>
            <Link className="l" href="/#how">How it works</Link>
            <Link className="l" href="/login">Citizen sign in</Link>
            <Link className="l" href="/staff/login">Staff</Link>
            <Link className="lbtn cor sm pub-desktop-cta" href="/register">I need help</Link>
          </>
        )}
      </div>
    </nav>
  );
}
