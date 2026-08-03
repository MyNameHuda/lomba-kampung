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
