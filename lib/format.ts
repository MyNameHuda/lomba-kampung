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

// =================== Juara label helper ===================
// Public Juara 1/2/3 are split per-(lomba, kategori). When a lomba has both
// `k_anak_l` and `k_anak_p` eligible, the same rank lives in two different
// sections — warga needs to know which is which without reading the section
// header. So we append "(Laki-laki)" / "(Perempuan)" for the L/P split.
//
// For other kategori (Balita single, Remaja mixed, Ibu-Ibu only female), the
// section header already conveys the gender context — no suffix needed.
//
// Used in: public detail page, admin Juara picker, XLSX Juara sheet.
//
// @param kategoriId  the section's kategori id
// @param rank        1, 2, or 3
// @returns "Juara 1 (Laki-laki)" for k_anak_l, "Juara 1 (Perempuan)" for
//          k_anak_p, "Juara 1" otherwise.
export function juaraLabel(kategoriId: string, rank: 1 | 2 | 3): string {
  if (kategoriId === "k_anak_l") return `Juara ${rank} (Laki-laki)`;
  if (kategoriId === "k_anak_p") return `Juara ${rank} (Perempuan)`;
  return `Juara ${rank}`;
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

/**
 * Get today's date as "YYYY-MM-DD" in Asia/Jakarta timezone.
 * Used to compare against lomba's per-kategori tanggal for time-based status.
 */
export function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Compare a unix-seconds tanggal (interpreted as calendar day in Asia/Jakarta)
 * against today in Asia/Jakarta. Returns:
 *   - "future"  if tanggal is strictly after today
 *   - "today"   if tanggal is today
 *   - "past"    if tanggal is strictly before today
 */
export function compareTglToToday(
  ts: number,
  today: string = todayInJakarta()
): "future" | "today" | "past" {
  const tgl = formatTanggalLomba(ts, "iso");
  if (tgl > today) return "future";
  if (tgl === today) return "today";
  return "past";
}

/**
 * Time-based status derived from per-kategori jadwal. Independent of
 * `lomba.status` (lomba lifecycle) — this is a derived "where are we
 * in the calendar" view for the public badge.
 *
 *   - "akan-datang"        → at least one kategori has tanggal in the future
 *   - "sedang-berlangsung" → at least one kategori has tanggal == today
 *   - "lewat-jadwal"       → all tanggal in the past (admin hasn't marked Selesai yet)
 *   - "belum-dijadwalkan"  → no tanggal set on any eligible kategori
 */
export type LombaTimeStatus = "akan-datang" | "sedang-berlangsung" | "lewat-jadwal" | "belum-dijadwalkan";

export function lombaTimeStatus(
  jadwalByKategori: Record<string, { tanggal: number | null; jam: string | null } | undefined> | undefined,
  eligibleKategori: string[],
  today: string = todayInJakarta()
): LombaTimeStatus {
  const jadwals = eligibleKategori
    .map((kid) => jadwalByKategori?.[kid])
    .filter((j): j is { tanggal: number; jam: string | null } => !!j && j.tanggal != null);
  if (jadwals.length === 0) return "belum-dijadwalkan";
  let todayCount = 0;
  let futureCount = 0;
  for (const j of jadwals) {
    const cmp = compareTglToToday(j.tanggal, today);
    if (cmp === "today") todayCount++;
    else if (cmp === "future") futureCount++;
  }
  if (todayCount > 0) return "sedang-berlangsung";
  if (futureCount > 0) return "akan-datang";
  return "lewat-jadwal";
}
