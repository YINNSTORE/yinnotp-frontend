import { NextResponse } from "next/server";

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, message: "Respon backend bukan JSON" };
  }
}

export async function POST(req) {
  const API =
    process.env.API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!API) {
    return NextResponse.json(
      { ok: false, message: "ENV API_BASE belum diset" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));

  const upstream = await fetch(`${API}/auth/session_login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await upstream.text();
  const data = safeJson(text);

  return NextResponse.json(data, {
    status: upstream.status,
    headers: { "Cache-Control": "no-store" },
  });
}