import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/logo", "/api/health"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (!req.cookies.get("swan_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|swan-logo.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
