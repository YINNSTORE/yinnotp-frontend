import { NextResponse } from "next/server";
import { rumahGet } from "../_base";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const service_id = url.searchParams.get("service_id");

  if (!service_id) {
    return NextResponse.json(
      { success: false, message: "service_id required" },
      { status: 400 }
    );
  }

  const { r, json, text } =
    await rumahGet(
      `https://www.rumahotp.com/api/v2/countries?service_id=${service_id}`
    );

  if (!r.ok) {
    return NextResponse.json(
      { success: false, raw: text },
      { status: 502 }
    );
  }

  return NextResponse.json(json);
}