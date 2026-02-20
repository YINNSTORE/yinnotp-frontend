import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json({ ok: false, message: "Not Found" }, { status: 404 });
}

export const GET = disabled;
export const POST = disabled;