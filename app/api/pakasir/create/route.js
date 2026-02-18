import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const method = (body.method || "qris").toString();
    const order_id = (body.order_id || "").toString().trim();
    const amountRaw = body.amount ?? "";
    const amount = Number(String(amountRaw).replace(/[^\d]/g, ""));

    const project = process.env.PAKASIR_PROJECT;
    const api_key = process.env.PAKASIR_API_KEY;

    if (!project || !api_key) {
      return NextResponse.json(
        { ok: false, error: "ENV PAKASIR_PROJECT / PAKASIR_API_KEY belum diset di server." },
        { status: 500 }
      );
    }
    if (!order_id) {
      return NextResponse.json({ ok: false, error: "order_id kosong." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "amount tidak valid." }, { status: 400 });
    }

    const url = `https://app.pakasir.com/api/transactioncreate/${encodeURIComponent(method)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // api_key tetap di server (AMAN)
      body: JSON.stringify({ project, order_id, amount, api_key }),
      cache: "no-store",
    });

    const text = await res.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Pakasir balikin respon non-JSON / kosong.",
          status: res.status,
          body_preview: (text || "").slice(0, 300),
        },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Pakasir error.", status: res.status, data },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}