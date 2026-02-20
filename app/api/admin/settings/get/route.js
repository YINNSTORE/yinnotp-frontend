export const runtime = "nodejs";

function pickAuth(req) {
  const h = req.headers.get("authorization");
  return h ? { Authorization: h } : {};
}

export async function GET(req) {
  try {
    const base = process.env.YINNOTP_BACKEND_BASE || "https://yinnhosting.serv00.net/api";
    const { searchParams } = new URL(req.url);

    const key = searchParams.get("key") || "";
    const keys = searchParams.get("keys") || "";

    const url = new URL(`${base}/admin/settings/get.php`);
    if (key) url.searchParams.set("key", key);
    if (keys) url.searchParams.set("keys", keys);

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json", ...pickAuth(req) },
      cache: "no-store",
    });

    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, message: "Proxy error" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}