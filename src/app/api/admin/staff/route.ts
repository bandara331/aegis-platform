import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [staffRes, healthRes] = await Promise.all([
      fetch(`${API_BASE_URL}/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }),
      fetch(`${API_BASE_URL}/health`, { cache: "no-store" }),
    ]);

    const staff = staffRes.ok ? await staffRes.json() : [];
    const health = healthRes.ok ? await healthRes.json() : null;

    return NextResponse.json({ staff, health });
  } catch {
    return NextResponse.json({ error: "Unable to reach admin service." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const res = await fetch(`${API_BASE_URL}/admin/staff/invite`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.detail || data.title || "Invite failed" }, { status: res.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to send staff invitation." }, { status: 502 });
  }
}
