import { db, transactions } from "@cfo-ai/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "active";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.status, status), isNull(transactions.deletedAt)),
    )
    .orderBy(desc(transactions.date))
    .limit(limit);

  return NextResponse.json({ transactions: rows });
}
