export const runtime = "nodejs";

function pickAuth(req) {
  const h = req.headers.get("authorization");
  return h ? { Authorization: h } : {};
}

export async function POST(req) {
  try {
    const base = process.env.YINNOTP_BACKEND_BASE || "https://yinnhosting.serv00.net/api";
    const body = await req.json().catch(() => ({}));

    const r = await fetch(`${base}/admin/users/balance_set.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...pickAuth(req),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: "Proxy error" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}