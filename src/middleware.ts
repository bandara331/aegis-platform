import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STAFF_ROLES = new Set([
  "EmergencyCoordinator",
  "CaseManager",
  "LogisticsManager",
  "ShelterAdmin",
  "VolunteerCoordinator",
  "DonorOfficer",
  "PartnerOfficer",
  "SystemAdmin",
]);

const CITIZEN_PATHS = ["/request", "/my-requests", "/assistant", "/profile"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("aegis_token")?.value;
  const role = request.cookies.get("aegis_role")?.value;

  // Legacy /command redirects to /admin
  if (pathname.startsWith("/command")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Staff-only guard on /admin
  if (pathname.startsWith("/admin")) {
    if (!token) {
      const loginUrl = new URL("/staff/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!role || !STAFF_ROLES.has(role)) {
      return NextResponse.redirect(new URL("/denied", request.url));
    }
  }

  // Citizen-only guard on citizen routes
  const isCitizenRoute = CITIZEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isCitizenRoute) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (role && role !== "Citizen") {
      return NextResponse.redirect(new URL("/denied", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/command/:path*",
    "/request/:path*",
    "/my-requests/:path*",
    "/assistant/:path*",
    "/profile/:path*",
  ],
};
