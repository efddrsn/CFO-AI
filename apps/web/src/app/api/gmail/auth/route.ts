import { gmail } from "@cfo-ai/integrations";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getGmailConfig, GMAIL_STATE_COOKIE } from "@/lib/gmail";

export const runtime = "nodejs";

/**
 * GET /api/gmail/auth → 302 pro consent screen do Google.
 * Cookie short-lived guarda `state` pra CSRF check no callback.
 */
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = getGmailConfig();
  const state = randomBytes(24).toString("hex");
  const url = gmail.buildAuthUrl(cfg, { state });

  const res = NextResponse.redirect(url);
  res.cookies.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10 min
  });
  return res;
}
