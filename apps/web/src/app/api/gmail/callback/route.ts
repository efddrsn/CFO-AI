import { db, integrationCredentials } from "@cfo-ai/db";
import { gmail } from "@cfo-ai/integrations";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getGmailConfig, GMAIL_STATE_COOKIE } from "@/lib/gmail";

export const runtime = "nodejs";

/**
 * GET /api/gmail/callback?code=...&state=...
 *
 * Troca o code por tokens, busca email do usuário Gmail, e faz upsert em
 * integration_credentials(provider='gmail', account_link=<email>).
 */
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/connect?gmail_error=${encodeURIComponent(errorParam)}`, req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const expectedState = req.cookies.get(GMAIL_STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.json({ error: "bad_state" }, { status: 400 });
  }

  try {
    const cfg = getGmailConfig();
    const tokens = await gmail.exchangeCodeForTokens(cfg, code);
    const profile = await gmail.getUserProfile(tokens.access_token);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);

    // upsert por (provider, account_link)
    const existing = await db
      .select({ id: integrationCredentials.id })
      .from(integrationCredentials)
      .where(
        and(
          eq(integrationCredentials.provider, "gmail"),
          eq(integrationCredentials.accountLink, profile.emailAddress),
        ),
      );

    if (existing.length > 0) {
      await db
        .update(integrationCredentials)
        .set({
          encryptedToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          scopes: JSON.stringify(scopes),
          expiresAt,
          lastRefreshAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(integrationCredentials.id, existing[0]!.id));
    } else {
      await db.insert(integrationCredentials).values({
        provider: "gmail",
        accountLink: profile.emailAddress,
        encryptedToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        scopes: JSON.stringify(scopes),
        expiresAt,
        lastRefreshAt: new Date(),
        metadata: JSON.stringify({ historyId: profile.historyId ?? null }),
      });
    }

    const res = NextResponse.redirect(
      new URL(`/connect?gmail_ok=${encodeURIComponent(profile.emailAddress)}`, req.url),
    );
    res.cookies.delete(GMAIL_STATE_COOKIE);
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: "gmail_oauth_error", message: String(err) },
      { status: 502 },
    );
  }
}
