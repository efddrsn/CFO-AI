import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie, verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/health",
  "/api/pluggy/webhook",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = getSessionCookie(req);
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();
  res.headers.set("x-user-id", session.userId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
