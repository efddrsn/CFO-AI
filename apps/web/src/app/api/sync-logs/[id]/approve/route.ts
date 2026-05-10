import { db, syncLogs, transactions } from "@cfo-ai/db";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [log] = await db.select().from(syncLogs).where(eq(syncLogs.id, id));
  if (!log) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (log.status !== "pending_review") {
    return NextResponse.json(
      { error: "invalid_state", current: log.status },
      { status: 409 },
    );
  }

  await db.transaction(async (tx) => {
    // marca todas as transações pendentes desse sync como ativas
    await tx
      .update(transactions)
      .set({ status: "active", updatedAt: new Date() })
      .where(
        and(
          eq(transactions.syncLogId, id),
          eq(transactions.status, "pending_sync"),
        ),
      );

    await tx
      .update(syncLogs)
      .set({
        status: "approved",
        approvedAt: new Date(),
        approvedBy: userId,
      })
      .where(eq(syncLogs.id, id));
  });

  return NextResponse.json({ ok: true });
}
