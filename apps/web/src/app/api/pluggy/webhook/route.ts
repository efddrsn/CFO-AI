import { db, integrationCredentials } from "@cfo-ai/db";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/pluggy/webhook
 *
 * Endpoint público (protegido por header secret se configurado) pra
 * eventos da Pluggy: item/created, item/updated, item/login_succeeded,
 * item/waiting_user_input, item/error, consent/created, consent/revoked, ...
 *
 * Doc: https://docs.pluggy.ai/docs/webhooks
 *
 * Por enquanto: apenas atualiza `last_refresh_at` em integration_credentials
 * pra eventos relevantes. Os syncs reais ficam no cron do ETL (não aqui).
 */
export async function POST(req: NextRequest) {
  // Validação opcional de header secret
  const expected = process.env.PLUGGY_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get("x-pluggy-secret");
    if (got !== expected) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const body = (await req.json().catch(() => null)) as
    | { event?: string; itemId?: string; clientId?: string }
    | null;

  if (!body?.event || !body.itemId) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.event.startsWith("item/")) {
    await db
      .update(integrationCredentials)
      .set({ lastRefreshAt: new Date() })
      .where(
        and(
          eq(integrationCredentials.provider, "pluggy"),
          eq(integrationCredentials.accountLink, body.itemId),
        ),
      );
  }

  // Eventos não tratados ainda: consent/revoked, consent/created (TODO Fase 5).
  return NextResponse.json({ ok: true });
}
