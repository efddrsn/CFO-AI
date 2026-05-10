import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-8 space-y-6">
      <h1 className="text-2xl font-semibold">CFO-AI</h1>
      <p className="text-zinc-400">
        Fase 0 — Fundação. Veja{" "}
        <Link href="/transactions" className="underline">
          /transactions
        </Link>{" "}
        e{" "}
        <Link href="/sync-logs" className="underline">
          /sync-logs
        </Link>
        .
      </p>
    </main>
  );
}
