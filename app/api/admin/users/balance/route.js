import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://yinnhosting.serv00.net/api";

export async function POST(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    const body = await req.text();

    const r = await fetch(`${API_BASE}/admin/users/balance.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body,
      cache: "no-store",
    });

    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Server error" },
      { status: 500 }
    );
  }
}