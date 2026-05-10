#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { pluggy } from "@cfo-ai/integrations";
import { syncAllPluggyItems, syncPluggyItem } from "../jobs/pluggy-sync";

const program = new Command();

program
  .name("pluggy-sync")
  .description("Sincroniza transações via Pluggy")
  .option("-i, --item <id>", "sincroniza apenas o item especificado")
  .option("-d, --days <n>", "janela retroativa em dias", "30")
  .action(async (opts: { item?: string; days: string }) => {
    const clientId = process.env.PLUGGY_CLIENT_ID;
    const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET are required");
      process.exit(1);
    }
    const windowDays = Number(opts.days);
    const client = new pluggy.PluggyClient({ clientId, clientSecret });

    // Falha cedo se credenciais estão inválidas — antes mesmo de ver quantos
    // items estão registrados. Caso contrário "Done: 0 item(s) synced" mascara
    // o problema de auth.
    try {
      await client.verifyAuth();
    } catch (err) {
      console.error("Pluggy auth failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }

    if (opts.item) {
      console.log(`Syncing item ${opts.item} (${windowDays}d window)...`);
      const summary = await syncPluggyItem(opts.item, client, { windowDays });
      console.log("Done:", summary);
    } else {
      console.log(`Syncing all Pluggy items (${windowDays}d window)...`);
      const summaries = await syncAllPluggyItems(client, { windowDays });
      console.log(`Done: ${summaries.length} item(s) synced.`);
      for (const s of summaries) {
        console.log(
          `  ${s.itemId}: +${s.inserted} new, ${s.skippedDuplicates} dup, ${s.errors} err (sync_log ${s.syncLogId})`,
        );
      }
    }
    process.exit(0);
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
