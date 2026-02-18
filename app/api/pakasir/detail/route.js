import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const order_id = (searchParams.get("order_id") || "").trim();
    const amountRaw = searchParams.get("amount") || "";
    const amount = Number(String(amountRaw).replace(/[^\d]/g, ""));

    const project = process.env.PAKASIR_PROJECT;
    const api_key = process.env.PAKASIR_API_KEY;

    if (!project || !api_key) {
      return NextResponse.json(
        { ok: false, error: "ENV PAKASIR_PROJECT / PAKASIR_API_KEY belum diset di server." },
        { status: 500 }
      );
    }
    if (!order_id || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Param order_id/amount invalid." }, { status: 400 });
    }

    const url = new URL("https://app.pakasir.com/api/transactiondetail");
    url.searchParams.set("project", project);
    url.searchParams.set("amount", String(amount));
    url.searchParams.set("order_id", order_id);
    url.searchParams.set("api_key", api_key);

    const res = await fetch(url.toString(), { cache: "no-store" });
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