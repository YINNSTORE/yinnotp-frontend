export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const API = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || "").replace(/\/+$/, "");

    if (!API) {
      return new Response(JSON.stringify({ ok: false, message: "API base belum diset (NEXT_PUBLIC_API_BASE)" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const upstream = await fetch(`${API}/auth/register.php`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: "Register proxy error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
