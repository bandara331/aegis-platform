import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/icons/Icon";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pub-shell">
      <nav className="pub-nav" aria-label="Main">
        <Link href="/" className="pub-logo">
          <LogoMark />
          AEGIS
        </Link>
        <Link className="l" href="/#how">How it works</Link>
        <Link className="l" href="/alerts">Alerts</Link>
        <Link className="l" href="/login">Citizen sign in</Link>
        <Link className="l" href="/staff/login">Staff</Link>
        <Link className="lbtn cor sm" href="/register">I need help</Link>
      </nav>

      <main className="pub-main">{children}</main>

      <footer className="pub-foot">
        <span>AEGIS · Humanitarian coordination platform</span>
        <span>English · සිංහල · தமிழ்</span>
      </footer>
    </div>
  );
}
