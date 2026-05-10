import Link from "next/link";

const sections: Array<{ href: string; label: string; desc: string }> = [
  { href: "/transactions", label: "Transações", desc: "Últimas movimentações ativas" },
  { href: "/sync-logs", label: "Sync logs", desc: "Importações e aprovações" },
  { href: "/connect", label: "Conectar contas", desc: "Pluggy (BR), Gmail (em breve)" },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <h1 className="text-2xl font-semibold">CFO-AI</h1>
      <nav className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded border border-zinc-800 hover:border-zinc-600 p-4"
          >
            <div className="font-medium">{s.label}</div>
            <div className="text-sm text-zinc-400">{s.desc}</div>
          </Link>
        ))}
      </nav>
    </main>
  );
}
