import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const res = await fetch(`${API_BASE_URL}/requests/${encodeURIComponent(id)}/duplicates`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to detect duplicates." }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to reach duplicate detection service." }, { status: 502 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const { action, primaryRequestId, candidateRequestId, notes } = body;

    let targetUrl = `${API_BASE_URL}/requests/${encodeURIComponent(id)}/duplicates/merge`;
    let targetPayload: Record<string, unknown> = { primaryRequestId: primaryRequestId || id, notes: notes || "Merged by coordinator." };

    if (action === "keep-separate") {
      targetUrl = `${API_BASE_URL}/requests/${encodeURIComponent(id)}/duplicates/keep-separate`;
      targetPayload = { candidateRequestId, notes: notes || "Confirmed separate by coordinator." };
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(targetPayload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || data.title || "Failed to process duplicate operation." },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to reach request service." }, { status: 502 });
  }
}
