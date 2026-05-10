"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SCRIPT_URL = "https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js";

// O widget injeta global `window.PluggyConnect` quando carregado.
declare global {
  interface Window {
    PluggyConnect?: new (opts: PluggyConnectOpts) => { init: () => void };
  }
}

type PluggyConnectOpts = {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess?: (data: { item: { id: string } }) => void;
  onError?: (err: { message?: string }) => void;
  onClose?: () => void;
};

function loadPluggyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.PluggyConnect) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("script load failed")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("script load failed"));
    document.head.appendChild(script);
  });
}

export function ConnectPluggyButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    loadPluggyScript().catch((e) =>
      setError(`Falha ao carregar widget Pluggy: ${e.message}`),
    );
  }, []);

  async function startConnect() {
    setError(null);
    setStatus(null);
    setLoading(true);

    try {
      const res = await fetch("/api/pluggy/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(body.message ?? body.error ?? "connect-token failed");
      }
      const { accessToken } = (await res.json()) as { accessToken: string };

      if (!window.PluggyConnect) {
        throw new Error("widget Pluggy não carregou");
      }

      const widget = new window.PluggyConnect({
        connectToken: accessToken,
        includeSandbox: process.env.NODE_ENV !== "production",
        onSuccess: async ({ item }) => {
          setStatus("Salvando item…");
          const saveRes = await fetch("/api/pluggy/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: item.id }),
          });
          if (!saveRes.ok) {
            const body = (await saveRes.json().catch(() => ({}))) as {
              message?: string;
            };
            setError(body.message ?? "Falha ao salvar item");
            return;
          }
          const data = (await saveRes.json()) as {
            connector: string;
            accountsCreated: number;
            totalAccounts: number;
          };
          setStatus(
            `${data.connector} conectado · ${data.accountsCreated}/${data.totalAccounts} contas novas`,
          );
          router.refresh();
        },
        onError: (err) => setError(err.message ?? "erro no widget"),
        onClose: () => setLoading(false),
      });
      widget.init();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startConnect}
        disabled={loading}
        className="rounded bg-zinc-100 text-zinc-900 px-4 py-2 font-medium disabled:opacity-50"
      >
        {loading ? "Abrindo…" : "Conectar via Pluggy"}
      </button>
      {status && <p className="text-sm text-green-400">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
