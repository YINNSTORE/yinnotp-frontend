export async function POST(req) {
  try {
    const { method, order_id, amount } = await req.json();

    const project = process.env.PAKASIR_PROJECT;
    const api_key = process.env.PAKASIR_API_KEY;
    const base = process.env.PAKASIR_BASE_URL || "https://app.pakasir.com";

    if (!project || !api_key) {
      return new Response(
        JSON.stringify({ ok: false, message: "Missing PAKASIR_PROJECT / PAKASIR_API_KEY env" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!method || !order_id || !Number.isFinite(Number(amount))) {
      return new Response(
        JSON.stringify({ ok: false, message: "Invalid payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const url = `${base}/api/transactioncreate/${encodeURIComponent(method)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        order_id,
        amount: Number(amount),
        api_key,
      }),
    });

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