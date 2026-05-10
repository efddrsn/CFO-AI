#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { syncAllGmailAccounts, syncGmail } from "../jobs/gmail-sync";

const program = new Command();

program
  .name("gmail-sync")
  .description("Extrai transações de emails (Pluggy/Itau/Nubank/Nomad) via Sonnet 4.6")
  .option("-e, --email <addr>", "sincroniza apenas a conta Gmail especificada")
  .option("-d, --days <n>", "janela retroativa em dias", "30")
  .option(
    "-f, --filters <keys>",
    "lista CSV de filtros a aplicar (ex: nubank_pix_received,itau_transaction_notification)",
  )
  .action(
    async (opts: { email?: string; days: string; filters?: string }) => {
      const windowDays = Number(opts.days);
      const filterKeys = opts.filters
        ? opts.filters.split(",").map((k) => k.trim()).filter(Boolean)
        : undefined;

      if (opts.email) {
        console.log(`Syncing Gmail ${opts.email} (${windowDays}d)…`);
        const summary = await syncGmail({
          email: opts.email,
          windowDays,
          filterKeys,
        });
        console.log("Done:", summary);
      } else {
        console.log(`Syncing all Gmail accounts (${windowDays}d)…`);
        const summaries = await syncAllGmailAccounts({ windowDays, filterKeys });
        console.log(`Done: ${summaries.length} account(s) synced.`);
        for (const s of summaries) {
          console.log(
            `  ${s.email}: scanned=${s.messagesScanned}, extracted=${s.transactionsExtracted}, +${s.inserted} new, ${s.skippedDuplicates} dup, ${s.errors} err (sync_log ${s.syncLogId})`,
          );
        }
      }
      process.exit(0);
    },
  );

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
