"use client";

import { useRouter } from "next/navigation";

export function PublicSignOutButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="lbtn dk sm"
      style={{ border: 0, cursor: "pointer" }}
    >
      Sign out
    </button>
  );
}
