import { db } from "@cfo-ai/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (err) {
    return NextResponse.json(
      { status: "degraded", db: "error", error: String(err) },
      { status: 503 },
    );
  }
}
