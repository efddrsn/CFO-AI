"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <main className="mx-auto max-w-md p-8 space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Algo deu errado</h1>
          <p className="text-zinc-400 text-sm">{error.message}</p>
          {error.digest && (
            <p className="text-xs text-zinc-500 font-mono">digest: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded bg-zinc-100 text-zinc-900 px-4 py-2 font-medium"
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
