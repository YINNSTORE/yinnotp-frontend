export async function POST(req) {
  try {
    const { order_id, amount } = await req.json();

    const project = process.env.PAKASIR_PROJECT;
    const api_key = process.env.PAKASIR_API_KEY;
    const base = process.env.PAKASIR_BASE_URL || "https://app.pakasir.com";

    if (!project || !api_key) {
      return new Response(
        JSON.stringify({ ok: false, message: "Missing PAKASIR_PROJECT / PAKASIR_API_KEY env" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(`${base}/api/transactioncancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, order_id, amount: Number(amount), api_key }),
    });

    const data = await res.json().catch(() => ({}));

    return new Response(JSON.stringify({ ok: res.ok, ...data }), {
      status: res.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}