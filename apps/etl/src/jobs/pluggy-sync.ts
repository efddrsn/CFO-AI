import {
  accounts as accountsTable,
  db,
  integrationCredentials,
  syncLogs,
  transactions as transactionsTable,
} from "@cfo-ai/db";
import { pluggy } from "@cfo-ai/integrations";
import { and, eq } from "drizzle-orm";
import { categorize } from "../lib/categorization";

export interface SyncSummary {
  itemId: string;
  syncLogId: string;
  accountsScanned: number;
  inserted: number;
  skippedDuplicates: number;
  errors: number;
}

/**
 * Sincroniza um item Pluggy: lê contas → transações → cria SyncLog(pending_review)
 * com transações em status pending_sync. Dedup por (account_id, source_txn_id).
 * Categoriza cada nova transação via pipeline rules → LLM.
 *
 * @param itemId Pluggy item_id
 * @param windowDays Quantos dias retroativos puxar (default 30)
 */
export async function syncPluggyItem(
  itemId: string,
  client: pluggy.PluggyClient,
  opts: { windowDays?: number } = {},
): Promise<SyncSummary> {
  const windowDays = opts.windowDays ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);

  // Cria SyncLog em "running"
  const [syncLog] = await db
    .insert(syncLogs)
    .values({
      source: "pluggy",
      status: "running",
      summary: { itemId, window: { from: fromIso, to: toIso } },
    })
    .returning();
  if (!syncLog) throw new Error("Failed to create sync_log");

  let inserted = 0;
  let skippedDuplicates = 0;
  let errors = 0;
  const diffEntries: Array<{
    accountId: string;
    description: string;
    amountCents: number;
    date: string;
    status: "inserted" | "duplicate" | "error";
    error?: string;
    categoryRationale?: string;
  }> = [];

  try {
    const pluggyAccounts = await client.listAccounts(itemId);

    for (const pluggyAcc of pluggyAccounts) {
      // Resolve conta CFO-AI por sourceAccountId
      const [cfoAccount] = await db
        .select()
        .from(accountsTable)
        .where(
          and(
            eq(accountsTable.source, "pluggy"),
            eq(accountsTable.sourceAccountId, pluggyAcc.id),
          ),
        );
      if (!cfoAccount) {
        console.warn(`No CFO account for Pluggy ${pluggyAcc.id}, skipping`);
        continue;
      }

      const txns = await client.listTransactions(pluggyAcc.id, {
        from: fromIso,
        to: toIso,
      });

      for (const txn of txns) {
        try {
          const mapped = pluggy.pluggyTxnToCfo(cfoAccount.id, txn);

          // Categorizar antes de inserir (pra registrar no rawJson)
          const cat = await categorize({
            originalDescription: mapped.originalDescription,
            description: mapped.description,
            counterparty: mapped.counterparty,
            amountCents: mapped.amountCents,
            currency: mapped.currency,
            accountType: cfoAccount.type,
          });

          const [row] = await db
            .insert(transactionsTable)
            .values({
              accountId: cfoAccount.id,
              date: mapped.date,
              amountCents: mapped.amountCents,
              currency: mapped.currency,
              originalDescription: mapped.originalDescription,
              description: mapped.description,
              counterparty: mapped.counterparty,
              categoryId: cat.categoryId,
              subcategoryId: cat.subcategoryId,
              installmentNumber: mapped.installmentNumber,
              installmentTotal: mapped.installmentTotal,
              installmentGroupId: mapped.installmentGroupId,
              sourceTxnId: mapped.sourceTxnId,
              rawJson: {
                pluggy: mapped.rawJson,
                categorization: {
                  source: cat.source,
                  confidence: cat.confidence,
                  rationale: cat.rationale,
                },
              },
              syncLogId: syncLog.id,
              status: "pending_sync",
            })
            .onConflictDoNothing()
            .returning({ id: transactionsTable.id });

          if (row) {
            inserted++;
            diffEntries.push({
              accountId: cfoAccount.id,
              description: mapped.description ?? mapped.originalDescription,
              amountCents: mapped.amountCents,
              date: mapped.date,
              status: "inserted",
              categoryRationale: `${cat.source}:${cat.rationale}`,
            });
          } else {
            skippedDuplicates++;
            diffEntries.push({
              accountId: cfoAccount.id,
              description: mapped.description ?? mapped.originalDescription,
              amountCents: mapped.amountCents,
              date: mapped.date,
              status: "duplicate",
            });
          }
        } catch (err) {
          errors++;
          diffEntries.push({
            accountId: cfoAccount.id,
            description: txn.description,
            amountCents: 0,
            date: txn.date.slice(0, 10),
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Atualiza credencial: lastRefreshAt
    await db
      .update(integrationCredentials)
      .set({ lastRefreshAt: new Date() })
      .where(
        and(
          eq(integrationCredentials.provider, "pluggy"),
          eq(integrationCredentials.accountLink, itemId),
        ),
      );

    await db
      .update(syncLogs)
      .set({
        status: "pending_review",
        finishedAt: new Date(),
        summary: {
          itemId,
          accountsScanned: pluggyAccounts.length,
          inserted,
          skippedDuplicates,
          errors,
          window: { from: fromIso, to: toIso },
        },
        diff: diffEntries.slice(0, 200), // cap pra não explodir jsonb
      })
      .where(eq(syncLogs.id, syncLog.id));

    return {
      itemId,
      syncLogId: syncLog.id,
      accountsScanned: pluggyAccounts.length,
      inserted,
      skippedDuplicates,
      errors,
    };
  } catch (err) {
    await db
      .update(syncLogs)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(syncLogs.id, syncLog.id));
    throw err;
  }
}

/**
 * Sync de todos os items Pluggy registrados.
 */
export async function syncAllPluggyItems(
  client: pluggy.PluggyClient,
  opts: { windowDays?: number } = {},
): Promise<SyncSummary[]> {
  const items = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.provider, "pluggy"));

  const results: SyncSummary[] = [];
  for (const item of items) {
    if (!item.accountLink) continue;
    try {
      const summary = await syncPluggyItem(item.accountLink, client, opts);
      results.push(summary);
    } catch (err) {
      console.error(`Sync ${item.accountLink} failed:`, err);
    }
  }
  return results;
}
