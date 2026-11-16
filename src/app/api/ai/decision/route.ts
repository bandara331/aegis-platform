import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recommendationId, action, justification, secondApproverId, overridePriority } = body;

    if (!recommendationId) {
      return NextResponse.json({ error: "Recommendation ID is required." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const res = await fetch(`${API_BASE_URL}/ai/recommendations/${recommendationId}/decision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        justification: justification || "",
        secondApproverId: secondApproverId || null,
        overridePriority: overridePriority || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Decision failed validation." }));
      return NextResponse.json(
        { error: err.detail || err.title || "Decision rejected by server." },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to reach decision service." }, { status: 502 });
  }
}
