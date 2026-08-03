import { NextResponse } from "next/server";
import { getSettings, countLombaAktif, countAllPendaftar } from "@/lib/db";

/**
 * Health check endpoint for load balancers / uptime monitors.
 * Returns 200 with a brief status payload if the app is alive
 * and the database is reachable.
 */
export async function GET() {
  try {
    const cfg = await getSettings();
    const lomba = await countLombaAktif();
    const pendaftar = await countAllPendaftar();
    return NextResponse.json({
      status: "ok",
      time: new Date().toISOString(),
      app: cfg?.appName ?? "Lomba Kampung",
      stats: { lombaAktif: lomba, totalPendaftar: pendaftar },
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "unknown" },
      { status: 503 }
    );
  }
}
