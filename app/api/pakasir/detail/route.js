export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const order_id = searchParams.get("order_id");
    const amount = searchParams.get("amount");

    const project = process.env.PAKASIR_PROJECT;
    const api_key = process.env.PAKASIR_API_KEY;
    const base = process.env.PAKASIR_BASE_URL || "https://app.pakasir.com";

    if (!project || !api_key) {
      return new Response(
        JSON.stringify({ ok: false, message: "Missing PAKASIR_PROJECT / PAKASIR_API_KEY env" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!order_id || !amount) {
      return new Response(JSON.stringify({ ok: false, message: "Missing order_id/amount" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url =
      `${base}/api/transactiondetail?project=${encodeURIComponent(project)}` +
      `&amount=${encodeURIComponent(amount)}` +
      `&order_id=${encodeURIComponent(order_id)}` +
      `&api_key=${encodeURIComponent(api_key)}`;

    const res = await fetch(url, { method: "GET" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, status: res.status, data }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, ...data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}