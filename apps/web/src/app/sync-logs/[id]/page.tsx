import {
  accounts as accountsTable,
  categories as categoriesTable,
  db,
  syncLogs,
  transactions as transactionsTable,
} from "@cfo-ai/db";
import { formatBRL, formatUSD } from "@cfo-ai/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ApproveButtons } from "../approve-buttons";

export const dynamic = "force-dynamic";

export default async function SyncLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [log] = await db.select().from(syncLogs).where(eq(syncLogs.id, id));
  if (!log) notFound();

  const txns = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.syncLogId, id))
    .orderBy(asc(transactionsTable.date));

  // joins manuais (poucos itens, OK)
  const accountIds = [...new Set(txns.map((t) => t.accountId))];
  const accountsRows = accountIds.length
    ? await db
        .select()
        .from(accountsTable)
        .where(inArray(accountsTable.id, accountIds))
    : [];
  const accountById = new Map(accountsRows.map((a) => [a.id, a]));

  const categoryIds = [
    ...new Set(
      txns
        .flatMap((t) => [t.categoryId, t.subcategoryId])
        .filter((x): x is string => !!x),
    ),
  ];
  const categoriesRows = categoryIds.length
    ? await db
        .select()
        .from(categoriesTable)
        .where(inArray(categoriesTable.id, categoryIds))
    : [];
  const categoryById = new Map(categoriesRows.map((c) => [c.id, c]));

  return (
    <main className="mx-auto max-w-6xl p-8 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Sync · {log.source}</h1>
        <span
          className={
            log.status === "pending_review"
              ? "text-yellow-400"
              : log.status === "approved"
              ? "text-green-400"
              : log.status === "rejected"
              ? "text-red-400"
              : log.status === "failed"
              ? "text-red-500"
              : "text-zinc-400"
          }
        >
          {log.status}
        </span>
      </div>
      <div className="text-sm text-zinc-400 space-y-1">
        <div>
          <span className="text-zinc-500">ID:</span>{" "}
          <span className="font-mono text-xs">{log.id}</span>
        </div>
        <div>
          <span className="text-zinc-500">Início:</span>{" "}
          {log.startedAt.toISOString().slice(0, 19)}
        </div>
        {log.finishedAt && (
          <div>
            <span className="text-zinc-500">Fim:</span>{" "}
            {log.finishedAt.toISOString().slice(0, 19)}
          </div>
        )}
        {log.summary != null && (
          <pre className="bg-zinc-900 rounded p-3 text-xs overflow-x-auto">
            {JSON.stringify(log.summary, null, 2)}
          </pre>
        )}
        {log.errorMessage && (
          <pre className="bg-red-950 text-red-200 rounded p-3 text-xs overflow-x-auto">
            {log.errorMessage}
          </pre>
        )}
      </div>

      {log.status === "pending_review" && (
        <div className="flex justify-end">
          <ApproveButtons syncLogId={log.id} />
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-2">
          Transações neste sync ({txns.length})
        </h2>
        {txns.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma transação registrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2">Data</th>
                <th>Descrição</th>
                <th>Conta</th>
                <th>Categoria</th>
                <th className="text-right">Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => {
                const acc = accountById.get(t.accountId);
                const cat = t.categoryId
                  ? categoryById.get(t.categoryId)
                  : null;
                const sub = t.subcategoryId
                  ? categoryById.get(t.subcategoryId)
                  : null;
                const fmt =
                  t.currency === "BRL" ? formatBRL : t.currency === "USD"
                    ? formatUSD
                    : (n: number) => `${(n / 100).toFixed(2)} ${t.currency}`;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-zinc-900 align-top"
                  >
                    <td className="py-2 font-mono">{t.date}</td>
                    <td>
                      <div>{t.description ?? t.originalDescription}</div>
                      {t.counterparty && (
                        <div className="text-xs text-zinc-500">
                          {t.counterparty}
                        </div>
                      )}
                      {t.installmentNumber && t.installmentTotal && (
                        <div className="text-xs text-yellow-500">
                          Parcela {t.installmentNumber}/{t.installmentTotal}
                        </div>
                      )}
                    </td>
                    <td>{acc?.name ?? "—"}</td>
                    <td>
                      {cat?.name ?? "—"}
                      {sub && (
                        <span className="text-zinc-500"> / {sub.name}</span>
                      )}
                    </td>
                    <td
                      className={`text-right font-mono ${t.amountCents < 0 ? "text-red-400" : "text-green-400"}`}
                    >
                      {fmt(t.amountCents)}
                    </td>
                    <td className="text-xs">
                      <span
                        className={
                          t.status === "active"
                            ? "text-green-400"
                            : t.status === "rejected"
                            ? "text-red-400"
                            : "text-zinc-400"
                        }
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
