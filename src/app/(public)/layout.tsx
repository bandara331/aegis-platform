import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { LogoMark } from "@/components/icons/Icon";
import { PublicSignOutButton } from "./PublicSignOutButton";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("aegis_token")?.value;
  const role = cookieStore.get("aegis_role")?.value;
  const isLoggedIn = Boolean(token);
  const isCitizen = isLoggedIn && (!role || role === "Citizen");
  const isStaff = isLoggedIn && Boolean(role && role !== "Citizen");

  return (
    <div className="pub-shell">
      <nav className="pub-nav" aria-label="Main">
        <Link href="/" className="pub-logo">
          <LogoMark />
          AEGIS
        </Link>
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
            <Link className="lbtn cor sm" href="/register">I need help</Link>
          </>
        )}
      </nav>

      <main className="pub-main">{children}</main>

      <footer className="pub-foot">
        <span>AEGIS · Humanitarian coordination platform</span>
        <span>English · සිංහල · தமிழ்</span>
      </footer>
    </div>
  );
}
