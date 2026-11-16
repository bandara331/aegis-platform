import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const apiRes = await fetch(`${API_BASE_URL}/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      return NextResponse.json(
        { error: data.detail || data.title || "Invitation acceptance failed" },
        { status: apiRes.status }
      );
    }

    const primaryRole = Array.isArray(data.roles) && data.roles.length > 0 ? data.roles[0] : "CaseManager";
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
    response.cookies.set("aegis_role", primaryRole, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: data.expiresInSeconds || 900,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Unable to reach invitation service." }, { status: 502 });
  }
}
