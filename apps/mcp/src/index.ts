#!/usr/bin/env node
/**
 * CFO-AI MCP server.
 *
 * Conecta clientes MCP (Claude Desktop, Claude Code, Cursor, agente proativo
 * interno) às ferramentas do CFO-AI. Lê direto do Postgres via Drizzle —
 * mesma DATABASE_URL do app web.
 *
 * Veja §5 da SPEC pra arquitetura MCP-first e lista de tools planejadas.
 * Esta é a versão Fase 0: tools de leitura básicas + sync approval.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { accounts, db, syncLogs, transactions } from "@cfo-ai/db";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

const server = new Server(
  { name: "cfo-ai", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// ----- tool definitions ------------------------------------------------------

const tools = [
  {
    name: "list_accounts",
    description: "Lista contas conectadas (BR, US, cripto).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_transactions",
    description:
      "Lista transações ativas (status='active'). Filtros opcionais por data e conta.",
    inputSchema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "ISO yyyy-mm-dd" },
        to_date: { type: "string", description: "ISO yyyy-mm-dd" },
        account_id: { type: "string" },
        limit: { type: "number", default: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_pending_syncs",
    description: "Lista importações aguardando aprovação humana.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "approve_sync",
    description:
      "Aprova um SyncLog: as transações pendentes viram 'active' (canônicas).",
    inputSchema: {
      type: "object",
      properties: { sync_log_id: { type: "string" } },
      required: ["sync_log_id"],
      additionalProperties: false,
    },
  },
  {
    name: "reject_sync",
    description:
      "Rejeita um SyncLog: as transações pendentes viram 'rejected' (não entram nos relatórios).",
    inputSchema: {
      type: "object",
      properties: { sync_log_id: { type: "string" } },
      required: ["sync_log_id"],
      additionalProperties: false,
    },
  },
  {
    name: "expense_summary",
    description:
      "Soma transações ativas no período por moeda. Retorna totais por currency.",
    inputSchema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "ISO yyyy-mm-dd" },
        to_date: { type: "string", description: "ISO yyyy-mm-dd" },
      },
      required: ["from_date", "to_date"],
      additionalProperties: false,
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

// ----- tool execution --------------------------------------------------------

const ListTxns = z.object({
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  account_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

const SyncId = z.object({ sync_log_id: z.string().uuid() });

const Period = z.object({ from_date: z.string(), to_date: z.string() });

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  switch (name) {
    case "list_accounts": {
      const rows = await db.select().from(accounts).where(eq(accounts.isActive, true));
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }

    case "list_transactions": {
      const a = ListTxns.parse(args ?? {});
      const conds = [
        eq(transactions.status, "active"),
        isNull(transactions.deletedAt),
      ];
      if (a.from_date) conds.push(gte(transactions.date, a.from_date));
      if (a.to_date) conds.push(lte(transactions.date, a.to_date));
      if (a.account_id) conds.push(eq(transactions.accountId, a.account_id));
      const rows = await db
        .select()
        .from(transactions)
        .where(and(...conds))
        .orderBy(desc(transactions.date))
        .limit(a.limit);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }

    case "list_pending_syncs": {
      const rows = await db
        .select()
        .from(syncLogs)
        .where(eq(syncLogs.status, "pending_review"))
        .orderBy(desc(syncLogs.startedAt));
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }

    case "approve_sync":
    case "reject_sync": {
      const { sync_log_id } = SyncId.parse(args ?? {});
      const newStatus = name === "approve_sync" ? "approved" : "rejected";
      const txStatus = name === "approve_sync" ? "active" : "rejected";

      await db.transaction(async (tx) => {
        await tx
          .update(transactions)
          .set({ status: txStatus, updatedAt: new Date() })
          .where(
            and(
              eq(transactions.syncLogId, sync_log_id),
              eq(transactions.status, "pending_sync"),
            ),
          );
        await tx
          .update(syncLogs)
          .set({ status: newStatus, approvedAt: new Date() })
          .where(eq(syncLogs.id, sync_log_id));
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, status: newStatus }) }],
      };
    }

    case "expense_summary": {
      const { from_date, to_date } = Period.parse(args ?? {});
      const rows = await db
        .select({
          currency: transactions.currency,
          totalCents: sql<number>`sum(${transactions.amountCents})::bigint`,
          count: sql<number>`count(*)::int`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.status, "active"),
            isNull(transactions.deletedAt),
            gte(transactions.date, from_date),
            lte(transactions.date, to_date),
          ),
        )
        .groupBy(transactions.currency);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("CFO-AI MCP server running on stdio");
