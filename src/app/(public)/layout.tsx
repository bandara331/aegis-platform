import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { PublicNav } from "./PublicNav";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("aegis_token")?.value;
  const role = cookieStore.get("aegis_role")?.value;
  const isLoggedIn = Boolean(token);
  const isCitizen = isLoggedIn && (!role || role === "Citizen");
  const isStaff = isLoggedIn && Boolean(role && role !== "Citizen");

  return (
    <div className="pub-shell">
      <PublicNav isCitizen={isCitizen} isStaff={isStaff} />

      <main className="pub-main">{children}</main>

      <footer className="pub-foot">
        <span>AEGIS · Humanitarian coordination platform</span>
        <span>English · සිංහල · தமிழ்</span>
      </footer>
    </div>
  );
}
