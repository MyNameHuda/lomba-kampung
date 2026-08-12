// Format helpers — Vue 3 port of lib/format.ts from Next.js app.
// All helpers are pure functions; safe to import from client or server.

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

/**
 * Compact nomor for display: "LMB-2026-0042" → "#0042".
 * The full number is preserved in the title attribute at the call site.
 */
export function shortNomor(full: string): string {
  const m = full.match(/(\d{4})$/);
  return m ? `#${m[1]}` : full;
}

// =================== Jadwal lomba helpers ===================

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

// =================== Public kategori display ===================
const KATEGORI_PUBLIC_NAME: Record<string, string> = {
  k_balita: "Balita",
  k_anak_l: "Anak",
  k_anak_p: "Anak",
  k_dewasa_p: "Ibu-Ibu",
};

export function publicKategoriName(kategoriId: string): string {
  return KATEGORI_PUBLIC_NAME[kategoriId] ?? kategoriId;
}

export function displayKategoriName(
  kategoriId: string,
  kat?: { nama: string } | null
): string {
  if (kategoriId === "k_anak_l" || kategoriId === "k_anak_p") return "Anak";
  if (kat?.nama) return kat.nama;
  return KATEGORI_PUBLIC_NAME[kategoriId] ?? kategoriId;
}

export function groupKategoriByPublicName(
  kategoriIds: string[],
  kats?: Map<string, { nama: string } | null | undefined>
): Array<{ publicName: string; kategoriIds: string[] }> {
  const groups = new Map<string, string[]>();
  for (const kid of kategoriIds) {
    const name = displayKategoriName(kid, kats?.get(kid));
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(kid);
  }
  return Array.from(groups.entries()).map(([publicName, kategoriIds]) => ({ publicName, kategoriIds }));
}

// =================== Juara label helper ===================
export function juaraLabel(kategoriId: string, rank: 1 | 2 | 3, forPublic: boolean = true): string {
  if (forPublic) return `Juara ${rank}`;
  if (kategoriId === "k_anak_l") return `Juara ${rank} (Laki-laki)`;
  if (kategoriId === "k_anak_p") return `Juara ${rank} (Perempuan)`;
  return `Juara ${rank}`;
}

/**
 * Format a unix-seconds timestamp as a human-readable Indonesian date in
 * Asia/Jakarta timezone.
 */
export function formatTanggalLomba(
  ts: number,
  style: "short" | "long" | "weekday-long" | "iso" = "short"
): string {
  const d = new Date(ts * 1000);
  if (style === "iso") {
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

export function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function compareTglToToday(
  ts: number,
  today: string = todayInJakarta()
): "future" | "today" | "past" {
  const tgl = formatTanggalLomba(ts, "iso");
  if (tgl > today) return "future";
  if (tgl === today) return "today";
  return "past";
}

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
