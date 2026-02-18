import { NextResponse } from "next/server";

export function middleware(req) {
  const pathname = req.nextUrl.pathname;

  // HANYA protect dashboard & order
  const protectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/order");

  if (!protectedRoute) return NextResponse.next();

  // next-auth cookie (kalau dipakai)
  const nextAuth =
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  // custom cookie (kalau suatu saat dipakai)
  const custom = req.cookies.get("yinnotp_token")?.value;

  if (!nextAuth && !custom) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/order/:path*"],
};