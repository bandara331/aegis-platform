import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("aegis_token")?.value;
  const refresh = cookieStore.get("aegis_refresh")?.value;

  if (token && refresh) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch {
      // Ignore network error during logout cleanup
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("aegis_token");
  response.cookies.delete("aegis_refresh");
  response.cookies.delete("aegis_role");
  return response;
}
