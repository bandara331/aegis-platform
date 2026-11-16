import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const apiRes = await fetch(`${API_BASE_URL}/auth/staff/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      return NextResponse.json(
        { error: data.detail || data.title || "Staff authentication failed", code: data.title },
        { status: apiRes.status }
      );
    }

    if (apiRes.status === 202 || data.requiresOtp) {
      return NextResponse.json({ requiresOtp: true, email: data.email }, { status: 202 });
    }

    const primaryRole = Array.isArray(data.roles) && data.roles.length > 0 ? data.roles[0] : "EmergencyCoordinator";
    const response = NextResponse.json({
      userId: data.userId,
      email: data.email,
      fullName: data.fullName,
      roles: data.roles,
    });

    response.cookies.set("aegis_token", data.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: data.expiresInSeconds || 900,
    });

    if (data.refreshToken) {
      response.cookies.set("aegis_refresh", data.refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    response.cookies.set("aegis_role", primaryRole, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: data.expiresInSeconds || 900,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Unable to reach staff authentication service." }, { status: 502 });
  }
}
