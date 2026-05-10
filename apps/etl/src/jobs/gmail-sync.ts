import { EmailParser, type ParsedTxn } from "@cfo-ai/agent";
import {
  accounts as accountsTable,
  db,
  integrationCredentials,
  syncLogs,
  transactions as transactionsTable,
} from "@cfo-ai/db";
import { gmail } from "@cfo-ai/integrations";
import { toCents } from "@cfo-ai/shared";
import { and, eq, sql } from "drizzle-orm";
import { categorize } from "../lib/categorization";

const DEFAULT_DAYS = 30;

export interface GmailSyncOptions {
  email: string;
  windowDays?: number;
  /** Aplica subset dos filtros padrão (por `key`). Default: todos. */
  filterKeys?: string[];
}

export interface GmailSyncSummary {
  email: string;
  syncLogId: string;
  filtersScanned: number;
  messagesScanned: number;
  transactionsExtracted: number;
  inserted: number;
  skippedDuplicates: number;
  errors: number;
}

/**
 * Lê emails via filtros conhecidos, extrai transações via LLM e cria
 * SyncLog(pending_review). Dedup por source_txn_id = "gmail:<messageId>:<idx>".
 *
 * Resolução de conta:
 * - Se o filter aponta pra "Nubank cartão", busca conta com source='pluggy'
 *   institution='Nubank' tipo='credit_card' (idealmente) OU primeira do tipo
 *   coerente. Se nada encontrar, cria conta virtual com source='gmail'.
 */
export async function syncGmail(
  opts: GmailSyncOptions,
): Promise<GmailSyncSummary> {
  const windowDays = opts.windowDays ?? DEFAULT_DAYS;
  const afterDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [cred] = await db
    .select()
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.provider, "gmail"),
        eq(integrationCredentials.accountLink, opts.email),
      ),
    );
  if (!cred?.refreshToken) {
    throw new Error(`Gmail credentials missing for ${opts.email}`);
  }

  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET are required",
    );
  }

  const credentials: gmail.GmailClientCredentials = {
    accessToken: cred.encryptedToken,
    refreshToken: cred.refreshToken,
    expiresAt: cred.expiresAt?.getTime() ?? 0,
  };

  const onRefresh = async (tokens: gmail.GmailOAuthTokens) => {
    await db
      .update(integrationCredentials)
      .set({
        encryptedToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? cred.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        lastRefreshAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrationCredentials.id, cred.id));
  };

  const client = new gmail.GmailClient(
    { clientId, clientSecret, redirectUri: "" },
    credentials,
    onRefresh,
  );

  const [syncLog] = await db
    .insert(syncLogs)
    .values({
      source: "gmail",
      status: "running",
      summary: { email: opts.email, window: { days: windowDays } },
    })
    .returning();
  if (!syncLog) throw new Error("Failed to create sync_log");

  const parser = new EmailParser();
  const filters = gmail.DEFAULT_FILTERS.filter(
    (f) => !opts.filterKeys || opts.filterKeys.includes(f.key),
  );

  let messagesScanned = 0;
  let transactionsExtracted = 0;
  let inserted = 0;
  let skippedDuplicates = 0;
  let errors = 0;
  const diffEntries: Array<{
    filter: string;
    messageId: string;
    txnIdx: number;
    description: string;
    date: string;
    amountCents: number;
    status: "inserted" | "duplicate" | "error";
    error?: string;
  }> = [];

  try {
    for (const filter of filters) {
      const query = gmail.buildQuery(filter, afterDate);
      const messageIds = await client.listAllMessages(query, { maxTotal: 200 });

      for (const messageId of messageIds) {
        messagesScanned++;
        try {
          const msg = await client.getMessage(messageId);
          const from = gmail.getHeader(msg, "From") ?? "";
          const subject = gmail.getHeader(msg, "Subject") ?? "";
          const emailDate =
            gmail.getHeader(msg, "Date") ??
            new Date(Number(msg.internalDate ?? Date.now())).toISOString();
          const emailDateIso = new Date(emailDate).toISOString().slice(0, 10);

          let parsed: ParsedTxn[] = [];
          let notes = "";
          let confidence = 0;

          if (filter.kind === "statement_pdf") {
            // pega primeiro PDF do email
            const attachments = gmail.listAttachments(msg);
            const pdf = attachments.find((a) =>
              a.mimeType === "application/pdf",
            );
            if (!pdf) {
              diffEntries.push({
                filter: filter.key,
                messageId,
                txnIdx: 0,
                description: "(no pdf attachment)",
                date: emailDateIso,
                amountCents: 0,
                status: "error",
                error: "expected PDF attachment, found none",
              });
              errors++;
              continue;
            }
            const att = await client.getAttachment(messageId, pdf.attachmentId);
            const pdfBase64 = att.data.replace(/-/g, "+").replace(/_/g, "/");
            const result = await parser.parsePdf({
              hint: {
                institution: filter.institution,
                kind: filter.kind,
                hint: filter.hint,
              },
              emailDate: emailDateIso,
              subject,
              from,
              pdfBase64,
            });
            parsed = result.transactions;
            notes = result.notes;
            confidence = result.confidence;
          } else {
            const body =
              gmail.extractPlainText(msg) ||
              stripHtml(gmail.extractHtml(msg)) ||
              msg.snippet ||
              "";
            const result = await parser.parseText({
              hint: {
                institution: filter.institution,
                kind: filter.kind,
                hint: filter.hint,
              },
              emailDate: emailDateIso,
              subject,
              from,
              body,
            });
            parsed = result.transactions;
            notes = result.notes;
            confidence = result.confidence;
          }

          transactionsExtracted += parsed.length;

          if (parsed.length === 0) continue;

          const accountId = await resolveAccountId(filter.institution, parsed[0]!.currency);

          for (let i = 0; i < parsed.length; i++) {
            const t = parsed[i]!;
            const amountCents = toCents(t.amount);
            const sourceTxnId = `gmail:${messageId}:${i}`;

            try {
              const cat = await categorize({
                originalDescription: t.description,
                counterparty: t.counterparty,
                amountCents,
                currency: t.currency,
                accountType: null,
              });

              const result = await db
                .insert(transactionsTable)
                .values({
                  accountId,
                  date: t.date,
                  amountCents,
                  currency: t.currency,
                  originalDescription: t.description,
                  description: t.description,
                  counterparty: t.counterparty ?? null,
                  categoryId: cat.categoryId,
                  subcategoryId: cat.subcategoryId,
                  installmentNumber: t.installment_number ?? null,
                  installmentTotal: t.installment_total ?? null,
                  installmentGroupId: null,
                  sourceTxnId,
                  rawJson: {
                    gmail: {
                      filter: filter.key,
                      messageId,
                      subject,
                      from,
                      notes,
                      llmConfidence: confidence,
                    },
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

              if (result.length > 0) {
                inserted++;
                diffEntries.push({
                  filter: filter.key,
                  messageId,
                  txnIdx: i,
                  description: t.description,
                  date: t.date,
                  amountCents,
                  status: "inserted",
                });
              } else {
                skippedDuplicates++;
                diffEntries.push({
                  filter: filter.key,
                  messageId,
                  txnIdx: i,
                  description: t.description,
                  date: t.date,
                  amountCents,
                  status: "duplicate",
                });
              }
            } catch (err) {
              errors++;
              diffEntries.push({
                filter: filter.key,
                messageId,
                txnIdx: i,
                description: t.description,
                date: t.date,
                amountCents,
                status: "error",
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        } catch (err) {
          errors++;
          diffEntries.push({
            filter: filter.key,
            messageId,
            txnIdx: 0,
            description: "(message fetch failed)",
            date: "",
            amountCents: 0,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    await db
      .update(syncLogs)
      .set({
        status: "pending_review",
        finishedAt: new Date(),
        summary: {
          email: opts.email,
          window: { days: windowDays },
          filtersScanned: filters.length,
          messagesScanned,
          transactionsExtracted,
          inserted,
          skippedDuplicates,
          errors,
        },
        diff: diffEntries.slice(0, 200),
      })
      .where(eq(syncLogs.id, syncLog.id));

    return {
      email: opts.email,
      syncLogId: syncLog.id,
      filtersScanned: filters.length,
      messagesScanned,
      transactionsExtracted,
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
 * Resolve a conta CFO-AI a usar pra transações desta instituição.
 * Heurística simples: tenta achar conta ativa cuja `institution` casa
 * (case-insensitive). Se não achar, cria conta "virtual" gmail+institution.
 */
async function resolveAccountId(
  institution: string,
  currency: string,
): Promise<string> {
  const found = await db
    .select()
    .from(accountsTable)
    .where(
      and(
        sql`lower(${accountsTable.institution}) = ${institution.toLowerCase()}`,
        eq(accountsTable.isActive, true),
      ),
    );
  if (found.length > 0) return found[0]!.id;

  const [virtualUser] = await db
    .select({ id: accountsTable.userId })
    .from(accountsTable)
    .limit(1);
  if (!virtualUser) throw new Error("No user/account exists yet");

  const [created] = await db
    .insert(accountsTable)
    .values({
      userId: virtualUser.id,
      name: `${institution} (Gmail)`,
      type: "other",
      institution,
      currency,
      source: "gmail",
      metadata: { virtual: true, createdBy: "gmail-sync" },
    })
    .returning();
  return created!.id;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Roda gmail-sync pra todas as contas Gmail registradas.
 */
export async function syncAllGmailAccounts(
  opts: Omit<GmailSyncOptions, "email"> = {},
): Promise<GmailSyncSummary[]> {
  const accountsList = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.provider, "gmail"));
  const results: GmailSyncSummary[] = [];
  for (const acc of accountsList) {
    if (!acc.accountLink) continue;
    try {
      const summary = await syncGmail({ email: acc.accountLink, ...opts });
      results.push(summary);
    } catch (err) {
      console.error(`Gmail sync ${acc.accountLink} failed:`, err);
    }
  }
  return results;
}
