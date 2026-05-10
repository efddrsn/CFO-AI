#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, accounts, syncLogs, transactions } from "@cfo-ai/db";
import { eq } from "drizzle-orm";
import { parseCsv } from "../parsers/csv.js";

const program = new Command();

program
  .name("import-csv")
  .description("Importa transações de um CSV pra um SyncLog pendente de revisão")
  .argument("<file>", "caminho do arquivo CSV")
  .requiredOption("-a, --account <id>", "uuid da conta de destino")
  .option(
    "--auto-approve",
    "aprova automaticamente o sync (pula revisão humana)",
    false,
  )
  .action(
    async (
      file: string,
      opts: { account: string; autoApprove: boolean },
    ) => {
      const fullPath = resolve(file);
      console.log(`Lendo ${fullPath}`);
      const content = readFileSync(fullPath, "utf-8");

      const rows = parseCsv(content);
      if (rows.length === 0) {
        console.log("Nenhuma linha encontrada.");
        process.exit(0);
      }
      console.log(`${rows.length} linhas parseadas.`);

      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, opts.account));
      if (!account) {
        console.error(`Conta ${opts.account} não encontrada`);
        process.exit(1);
      }

      const [syncLog] = await db
        .insert(syncLogs)
        .values({
          source: "csv",
          accountId: account.id,
          status: "running",
          summary: { input_rows: rows.length },
        })
        .returning();
      if (!syncLog) {
        console.error("Falha ao criar SyncLog");
        process.exit(1);
      }

      let inserted = 0;
      let skipped = 0;

      for (const row of rows) {
        const result = await db
          .insert(transactions)
          .values({
            accountId: account.id,
            date: row.date,
            amountCents: row.amountCents,
            currency: row.currency ?? account.currency,
            originalDescription: row.description,
            counterparty: row.counterparty,
            sourceTxnId: row.sourceTxnId,
            syncLogId: syncLog.id,
            status: opts.autoApprove ? "active" : "pending_sync",
          })
          .onConflictDoNothing()
          .returning({ id: transactions.id });
        if (result.length > 0) inserted++;
        else skipped++;
      }

      const finalStatus = opts.autoApprove
        ? "approved"
        : "pending_review";

      await db
        .update(syncLogs)
        .set({
          status: finalStatus,
          finishedAt: new Date(),
          ...(opts.autoApprove ? { approvedAt: new Date() } : {}),
          summary: {
            input_rows: rows.length,
            inserted,
            skipped,
          },
        })
        .where(eq(syncLogs.id, syncLog.id));

      console.log(
        `SyncLog ${syncLog.id} → ${finalStatus} (inserted=${inserted}, skipped=${skipped})`,
      );
      if (!opts.autoApprove) {
        console.log("Aprove em /sync-logs ou via tool MCP `approve_sync`.");
      }
      process.exit(0);
    },
  );

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
