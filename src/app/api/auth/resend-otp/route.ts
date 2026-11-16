import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiRes = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      return NextResponse.json(
        { error: data.detail || data.title || "Please wait before requesting another code." },
        { status: apiRes.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to reach OTP service." }, { status: 502 });
  }
}
