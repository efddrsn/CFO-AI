import { db, accounts, integrationCredentials } from "@cfo-ai/db";
import { pluggy } from "@cfo-ai/integrations";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPluggyClient } from "@/lib/pluggy";

export const runtime = "nodejs";

/**
 * POST /api/pluggy/items
 *
 * Chamado pelo `/connect` quando o widget Pluggy retorna sucesso.
 * - Salva integration_credentials(provider="pluggy", account_link=itemId)
 * - Cria accounts no CFO-AI espelhando contas Pluggy (idempotente)
 */

const Body = z.object({ itemId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { itemId } = parsed.data;

  try {
    const client = getPluggyClient();
    const item = await client.getItem(itemId);
    const pluggyAccounts = await client.listAccounts(itemId);

    // 1. integration_credentials — upsert por (provider, accountLink)
    await db
      .insert(integrationCredentials)
      .values({
        provider: "pluggy",
        accountLink: itemId,
        encryptedToken: "", // Pluggy não retorna token reutilizável; o item_id basta
        expiresAt: item.consentExpiresAt ? new Date(item.consentExpiresAt) : null,
        lastRefreshAt: new Date(),
        metadata: JSON.stringify({
          connectorId: item.connector.id,
          connectorName: item.connector.name,
        }),
      })
      .onConflictDoNothing();

    // 2. accounts — uma por conta Pluggy
    const created: string[] = [];
    for (const acc of pluggyAccounts) {
      const existing = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.source, "pluggy"),
            eq(accounts.sourceAccountId, acc.id),
          ),
        );
      if (existing.length > 0) continue;

      const [row] = await db
        .insert(accounts)
        .values({
          userId,
          name: acc.marketingName ?? acc.name,
          type: pluggy.mapAccountType(acc),
          institution: item.connector.name,
          currency: acc.currencyCode,
          source: "pluggy",
          sourceAccountId: acc.id,
          metadata: {
            pluggyItemId: itemId,
            pluggyAccountSubtype: acc.subtype,
            connector: item.connector.name,
          },
        })
        .returning({ id: accounts.id });
      if (row) created.push(row.id);
    }

    return NextResponse.json({
      ok: true,
      itemId,
      connector: item.connector.name,
      consentExpiresAt: item.consentExpiresAt,
      accountsCreated: created.length,
      totalAccounts: pluggyAccounts.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "pluggy_error", message: String(err) },
      { status: 502 },
    );
  }
}

/**
 * GET /api/pluggy/items — lista items conectados.
 */
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.provider, "pluggy"));
  return NextResponse.json({ items: rows });
}
