import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const row = (await db.prepare(`SELECT COUNT(*) c FROM participants`).get()) as { c: number };
    return NextResponse.json({ ok: true, status: "healthy", participants: row.c, time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, status: "degraded", error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
