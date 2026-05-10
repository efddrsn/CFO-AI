"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApproveButtons({ syncLogId }: { syncLogId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function act(kind: "approve" | "reject") {
    setBusy(kind);
    await fetch(`/api/sync-logs/${syncLogId}/${kind}`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex gap-2 justify-end">
      <button
        type="button"
        onClick={() => act("approve")}
        disabled={busy !== null}
        className="rounded bg-green-700 px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        {busy === "approve" ? "..." : "Aprovar"}
      </button>
      <button
        type="button"
        onClick={() => act("reject")}
        disabled={busy !== null}
        className="rounded bg-red-700 px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        {busy === "reject" ? "..." : "Rejeitar"}
      </button>
    </div>
  );
}
