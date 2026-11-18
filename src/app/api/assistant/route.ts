import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "You have to log in first to use AI features." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const res = await fetch(`${API_BASE_URL}/assistant`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || data.title || "AI assistant is currently unavailable." },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Unable to reach AI assistant service." },
      { status: 502 }
    );
  }
}
