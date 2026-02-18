// middleware.js
import { NextResponse } from "next/server";

export function middleware() {
  // IMPORTANT: middleware wajib ada biar Vercel gak 500
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/order/:path*"], // JANGAN INCLUDE /topup
};