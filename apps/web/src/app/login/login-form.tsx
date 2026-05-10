"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha no login");
      return;
    }
    router.replace(from);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        required
        className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="senha"
        required
        className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-zinc-100 text-zinc-900 px-3 py-2 font-medium disabled:opacity-50"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  );
}
