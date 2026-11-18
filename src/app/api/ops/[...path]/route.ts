import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

async function proxy(request: Request, pathSegments: string[]) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    const url = new URL(request.url);
    const target = `${API_BASE_URL}/${pathSegments.map(encodeURIComponent).join("/")}${url.search}`;

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (request.method !== "GET" && request.method !== "HEAD") {
      headers["Content-Type"] = "application/json";
    }

    const bodyText =
      request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined;

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: bodyText && bodyText.length > 0 ? bodyText : undefined,
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || data.title || data.error || `Request failed (HTTP ${res.status})` },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Unable to reach AEGIS backend API." }, { status: 502 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(request, path);
}
