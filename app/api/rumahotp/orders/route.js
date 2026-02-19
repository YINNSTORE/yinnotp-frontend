import { NextResponse } from "next/server";
import { rumahGet } from "../_base";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const number_id = url.searchParams.get("number_id");
  const provider_id = url.searchParams.get("provider_id");
  const operator_id = url.searchParams.get("operator_id");

  if (!number_id || !provider_id || !operator_id) {
    return NextResponse.json(
      { success: false, message: "number_id, provider_id, operator_id required" },
      { status: 400 }
    );
  }

  const { r, json, text } =
    await rumahGet(
      `https://www.rumahotp.com/api/v2/orders?number_id=${number_id}&provider_id=${provider_id}&operator_id=${operator_id}`
    );

  if (!r.ok) {
    return NextResponse.json(
      { success: false, raw: text },
      { status: 502 }
    );
  }

  return NextResponse.json(json);
}