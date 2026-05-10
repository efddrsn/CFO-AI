import { db, integrationCredentials } from "@cfo-ai/db";
import { eq } from "drizzle-orm";
import { ConnectPluggyButton } from "./connect-pluggy-button";

export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  const items = await db
    .select()
    .from(integrationCredentials)
    .where(eq(integrationCredentials.provider, "pluggy"));

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Conectar contas</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Open Finance BR (Pluggy)</h2>
        <p className="text-sm text-zinc-400">
          Conecte Itaú, Nubank, BB, Inter, etc. Use o widget Pluggy Connect —
          OFB regulado ou conexão direta dependendo do banco.
        </p>
        <ConnectPluggyButton />
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mt-4">
            Items conectados
          </h3>
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500 mt-1">Nenhum.</p>
          ) : (
            <table className="w-full text-sm mt-2">
              <thead className="text-left text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="py-2">Item ID</th>
                  <th>Instituição</th>
                  <th>Consent expira</th>
                  <th>Último refresh</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const meta = it.metadata
                    ? (JSON.parse(it.metadata) as {
                        connectorName?: string;
                      })
                    : null;
                  return (
                    <tr key={it.id} className="border-b border-zinc-900">
                      <td className="py-2 font-mono text-xs">
                        {it.accountLink}
                      </td>
                      <td>{meta?.connectorName ?? "—"}</td>
                      <td>
                        {it.expiresAt
                          ? it.expiresAt.toISOString().slice(0, 10)
                          : "—"}
                      </td>
                      <td>
                        {it.lastRefreshAt
                          ? it.lastRefreshAt.toISOString().slice(0, 16)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
