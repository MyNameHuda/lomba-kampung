// Settings CRUD — app-wide configuration (app name, kampung name, etc.)
// + admin password hash. Single-row table; defaults seeded by schema.
import { get, run } from "./client";
import { toCamel } from "./internal";
import type { Settings } from "./types";

export async function getSettings(): Promise<Settings | null> {
  const row = await get("SELECT * FROM settings ORDER BY id LIMIT 1");
  return toCamel<Settings>(row);
}

export async function updateSettings(s: { appName: string; kampungName: string; tahunAktif: string }): Promise<void> {
  const existing = await getSettings();
  if (existing) {
    await run(
      "UPDATE settings SET app_name = ?, kampung_name = ?, tahun_aktif = ?, updated_at = unixepoch() WHERE id = ?",
      s.appName,
      s.kampungName,
      s.tahunAktif,
      existing.id
    );
  } else {
    await run(
      "INSERT INTO settings (app_name, kampung_name, tahun_aktif, admin_password_hash) VALUES (?, ?, ?, ?)",
      s.appName,
      s.kampungName,
      s.tahunAktif,
      ""
    );
  }
}

export async function updateAdminPassword(newHash: string): Promise<void> {
  const existing = await getSettings();
  if (existing) {
    await run(
      "UPDATE settings SET admin_password_hash = ?, updated_at = unixepoch() WHERE id = ?",
      newHash,
      existing.id
    );
  } else {
    await run(
      "INSERT INTO settings (app_name, kampung_name, tahun_aktif, admin_password_hash) VALUES (?, ?, ?, ?)",
      "Lomba Kampung",
      "Kampung Merdeka",
      "HUT RI ke-81 (2026)",
      newHash
    );
  }
}
