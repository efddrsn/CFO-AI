import { db, syncLogs } from "@cfo-ai/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const rows = await db
    .select()
    .from(syncLogs)
    .where(status ? eq(syncLogs.status, status) : undefined)
    .orderBy(desc(syncLogs.startedAt))
    .limit(100);

  return NextResponse.json({ syncLogs: rows });
}
