import { db, syncLogs } from "@cfo-ai/db";
import { desc } from "drizzle-orm";
import { ApproveButtons } from "./approve-buttons";

export const dynamic = "force-dynamic";

export default async function SyncLogsPage() {
  const rows = await db
    .select()
    .from(syncLogs)
    .orderBy(desc(syncLogs.startedAt))
    .limit(50);

  return (
    <main className="mx-auto max-w-6xl p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Sync logs</h1>
      <p className="text-zinc-400 text-sm">
        Importações pendentes de revisão antes de virar canônicas.
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-400 border-b border-zinc-800">
          <tr>
            <th className="py-2">Início</th>
            <th>Fonte</th>
            <th>Status</th>
            <th>Resumo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-zinc-900 align-top">
              <td className="py-2 font-mono">
                {s.startedAt.toISOString().slice(0, 19)}
              </td>
              <td>{s.source}</td>
              <td>
                <span
                  className={
                    s.status === "pending_review"
                      ? "text-yellow-400"
                      : s.status === "approved"
                      ? "text-green-400"
                      : s.status === "rejected"
                      ? "text-red-400"
                      : "text-zinc-400"
                  }
                >
                  {s.status}
                </span>
              </td>
              <td className="font-mono text-xs">
                {s.summary ? JSON.stringify(s.summary) : "—"}
              </td>
              <td className="text-right">
                {s.status === "pending_review" && (
                  <ApproveButtons syncLogId={s.id} />
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-zinc-500">
                Nenhum sync ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
