import { db, transactions } from "@cfo-ai/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { formatBRL } from "@cfo-ai/shared";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.status, "active"), isNull(transactions.deletedAt)),
    )
    .orderBy(desc(transactions.date))
    .limit(100);

  return (
    <main className="mx-auto max-w-6xl p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Transações</h1>
      <p className="text-zinc-400 text-sm">Mostrando até 100 transações ativas.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-400 border-b border-zinc-800">
          <tr>
            <th className="py-2">Data</th>
            <th>Descrição</th>
            <th className="text-right">Valor</th>
            <th>Moeda</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-zinc-900">
              <td className="py-2">{t.date}</td>
              <td>{t.description ?? t.originalDescription}</td>
              <td className="text-right font-mono">
                {t.currency === "BRL"
                  ? formatBRL(t.amountCents)
                  : `${(t.amountCents / 100).toFixed(2)}`}
              </td>
              <td>{t.currency}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-zinc-500">
                Nenhuma transação ativa. Importe um CSV via{" "}
                <code>pnpm import-csv</code>.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
