import { db, integrationCredentials } from "@cfo-ai/db";
import { eq } from "drizzle-orm";
import { ConnectPluggyButton } from "./connect-pluggy-button";

export const dynamic = "force-dynamic";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_ok?: string; gmail_error?: string }>;
}) {
  const sp = await searchParams;
  const [pluggyItems, gmailItems] = await Promise.all([
    db
      .select()
      .from(integrationCredentials)
      .where(eq(integrationCredentials.provider, "pluggy")),
    db
      .select()
      .from(integrationCredentials)
      .where(eq(integrationCredentials.provider, "gmail")),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-8">
      <h1 className="text-2xl font-semibold">Conectar contas</h1>

      {sp.gmail_ok && (
        <p className="text-sm text-green-400">
          Gmail conectado: {sp.gmail_ok}
        </p>
      )}
      {sp.gmail_error && (
        <p className="text-sm text-red-400">
          Erro no Gmail OAuth: {sp.gmail_error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Open Finance BR (Pluggy)</h2>
        <p className="text-sm text-zinc-400">
          Conecte Itaú, Nubank, BB, Inter, etc. via OFB regulado ou conexão direta.
        </p>
        <ConnectPluggyButton />
        <h3 className="text-sm font-medium text-zinc-300 mt-4">Items conectados</h3>
        {pluggyItems.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2">Item ID</th>
                <th>Instituição</th>
                <th>Consent expira</th>
                <th>Último refresh</th>
              </tr>
            </thead>
            <tbody>
              {pluggyItems.map((it) => {
                const meta = it.metadata
                  ? (JSON.parse(it.metadata) as { connectorName?: string })
                  : null;
                return (
                  <tr key={it.id} className="border-b border-zinc-900">
                    <td className="py-2 font-mono text-xs">{it.accountLink}</td>
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
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Email (Gmail)</h2>
        <p className="text-sm text-zinc-400">
          Pega Pix do Nubank em tempo real, fatura PDF mensal, statement
          Nomad — tudo via filtros do Gmail + Sonnet 4.6.
        </p>
        <a
          href="/api/gmail/auth"
          className="inline-block rounded bg-zinc-100 text-zinc-900 px-4 py-2 font-medium"
        >
          Conectar Gmail
        </a>
        <h3 className="text-sm font-medium text-zinc-300 mt-4">Contas Gmail</h3>
        {gmailItems.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2">Email</th>
                <th>Conectado em</th>
                <th>Último refresh</th>
              </tr>
            </thead>
            <tbody>
              {gmailItems.map((it) => (
                <tr key={it.id} className="border-b border-zinc-900">
                  <td className="py-2">{it.accountLink}</td>
                  <td>{it.createdAt.toISOString().slice(0, 10)}</td>
                  <td>
                    {it.lastRefreshAt
                      ? it.lastRefreshAt.toISOString().slice(0, 16)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
