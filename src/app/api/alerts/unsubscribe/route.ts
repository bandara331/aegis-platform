import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!token) {
    return new NextResponse("Missing unsubscribe token.", { status: 400 });
  }
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/unsubscribe?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    const msg = res.ok ? (data.message || "Unsubscribed from automated weather advisories.") : (data.error || "Invalid unsubscribe link.");
    return new NextResponse(
      `<!doctype html><html><body style="font-family:sans-serif;padding:40px;max-width:520px;margin:auto"><h2>AEGIS Weather Advisories</h2><p>${msg}</p></body></html>`,
      { status: res.status, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch {
    return new NextResponse("Unable to process unsubscribe request right now.", { status: 502 });
  }
}
