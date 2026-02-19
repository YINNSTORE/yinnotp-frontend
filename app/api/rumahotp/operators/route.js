import { NextResponse } from "next/server";
import { rumahGet } from "../_base";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const country = url.searchParams.get("country");
  const provider_id = url.searchParams.get("provider_id");

  if (!country || !provider_id) {
    return NextResponse.json(
      { success: false, message: "country & provider_id required" },
      { status: 400 }
    );
  }

  const { r, json, text } =
    await rumahGet(
      `https://www.rumahotp.com/api/v2/operators?country=${country}&provider_id=${provider_id}`
    );

  if (!r.ok) {
    return NextResponse.json(
      { success: false, raw: text },
      { status: 502 }
    );
  }

  return NextResponse.json(json);
}