import { NextResponse } from "next/server";
import { rawDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await rawDb.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "database connection error";
    return NextResponse.json({ status: "degraded", database: "down", error }, { status: 503 });
  }
}
