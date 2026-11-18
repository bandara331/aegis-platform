import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isMeContact = searchParams.get("me") === "1";
    const endpoint = isMeContact ? `${API_BASE_URL}/requests/me-contact` : `${API_BASE_URL}/requests`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Unable to reach backend API." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const idempotencyKey = request.headers.get("Idempotency-Key") || "";

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const res = await fetch(`${API_BASE_URL}/requests`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.code === "POSSIBLE_DUPLICATE") {
      return NextResponse.json(data, { status: 409 });
    }

    if (!res.ok) {
      const errorMsg =
        data.detail ||
        data.title ||
        (data.errors ? Object.values(data.errors).flat().join(" ") : "Failed to submit request.");
      return NextResponse.json({ error: errorMsg }, { status: res.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to reach request service." }, { status: 502 });
  }
}
