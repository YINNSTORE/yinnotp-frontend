import { NextResponse } from "next/server";
import { rumahGet } from "../_base";

export const dynamic = "force-dynamic";

export async function GET() {
  const { r, json, text } =
    await rumahGet("https://www.rumahotp.com/api/v2/services");

  if (!r.ok) {
    return NextResponse.json(
      { success: false, raw: text },
      { status: 502 }
    );
  }

  return NextResponse.json(json);
}