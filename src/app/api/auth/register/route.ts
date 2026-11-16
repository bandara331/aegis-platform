import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const apiRes = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      const errorMsg =
        data.detail ||
        data.title ||
        (data.errors ? Object.values(data.errors).flat().join(" ") : "Registration failed");
      return NextResponse.json({ error: errorMsg }, { status: apiRes.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to reach registration service." }, { status: 502 });
  }
}
