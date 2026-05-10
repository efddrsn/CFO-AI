import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 space-y-4 text-center">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-zinc-400">Página não encontrada.</p>
      <Link href="/" className="underline text-zinc-200">
        Voltar pro início
      </Link>
    </main>
  );
}
