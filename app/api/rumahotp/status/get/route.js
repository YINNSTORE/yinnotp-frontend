import { NextResponse } from "next/server";
import { rumahGet } from "../../_base";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const order_id = url.searchParams.get("order_id");

  if (!order_id) {
    return NextResponse.json(
      { success: false, message: "order_id required" },
      { status: 400 }
    );
  }

  const { r, json, text } =
    await rumahGet(
      `https://www.rumahotp.com/api/v1/orders/get_status?order_id=${order_id}`
    );

  if (!r.ok) {
    return NextResponse.json(
      { success: false, raw: text },
      { status: 502 }
    );
  }

  return NextResponse.json(json);
}