/**
 * Format helpers shared across admin and public UI.
 */

/**
 * Extract up to 2 uppercase initials from a person's name.
 * Example: "Bu Yuni" → "BY", "Hartono Wijaya" → "HW".
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Human-readable "X minutes ago" / "X hours ago" / "X days ago" in Indonesian.
 */
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

/**
 * Short Indonesian date format: "3 Agu, 17.38".
 */
export function dateFmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// =================== Jadwal lomba helpers ===================
// Tanggal lomba is stored as a unix-seconds timestamp representing **midnight
// UTC** of the chosen calendar day. This avoids the timezone trap where a
// date picked as "2026-08-15" in a UTC+7 browser got silently shifted to
// "2026-08-14 UTC" by `new Date(y, m-1, d, 0, 0, 0).getTime() / 1000`.
//
// Display layer always uses Asia/Jakarta (WIB) since this app is for a
// specific Indonesian village event — the date is event-local, not the
// viewer's local. Same display regardless of where the request is served.

/**
 * Convert "YYYY-MM-DD" string (from <input type="date">) to a unix-seconds
 * timestamp at midnight UTC. Treats the date as calendar day, not moment.
 */
export function dateStrToTs(value: string): number {
  return Math.floor(new Date(value + "T00:00:00Z").getTime() / 1000);
}

/**
 * Convert a unix-seconds timestamp back to "YYYY-MM-DD" string in UTC.
 * Use for repopulating <input type="date"> (the input expects YYYY-MM-DD).
 */
export function tsToUtcDateStr(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

/**
 * Format a unix-seconds timestamp as a human-readable Indonesian date in
 * Asia/Jakarta timezone. Used for public display + XLSX export — these all
 * run on the server (Vercel Lambda, UTC) so the default `toLocaleDateString`
 * would shift the date by ±1 day for WIB users.
 *
 * @param ts unix seconds
 * @param style "short" (default, e.g. "17 Agt 2026"), "long" (e.g. "Senin, 17 Agustus 2026"),
 *            "weekday-long" (e.g. "Senin, 17 Agustus 2026"), or "iso" (YYYY-MM-DD)
 */
export function formatTanggalLomba(
  ts: number,
  style: "short" | "long" | "weekday-long" | "iso" = "short"
): string {
  const d = new Date(ts * 1000);
  if (style === "iso") {
    // YYYY-MM-DD in Asia/Jakarta. Re-extract from the Jakarta-shifted date.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    const m = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    return `${y}-${m}-${day}`;
  }
  if (style === "long") {
    return d.toLocaleDateString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (style === "weekday-long") {
    return d.toLocaleDateString("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
