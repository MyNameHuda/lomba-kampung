// Settings CRUD — app-wide configuration + admin password hash. Postgres port.
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
      `UPDATE settings SET app_name = $1, kampung_name = $2, tahun_aktif = $3,
       updated_at = EXTRACT(EPOCH FROM NOW())::bigint WHERE id = $4`,
      s.appName,
      s.kampungName,
      s.tahunAktif,
      existing.id
    );
  } else {
    await run(
      `INSERT INTO settings (app_name, kampung_name, tahun_aktif, admin_password_hash)
       VALUES ($1, $2, $3, $4)`,
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
      `UPDATE settings SET admin_password_hash = $1,
       updated_at = EXTRACT(EPOCH FROM NOW())::bigint WHERE id = $2`,
      newHash,
      existing.id
    );
  } else {
    await run(
      `INSERT INTO settings (app_name, kampung_name, tahun_aktif, admin_password_hash)
       VALUES ($1, $2, $3, $4)`,
      "Lomba Kampung",
      "Kampung Kadu Jaya",
      "HUT RI ke-81 (2026)",
      newHash
    );
  }
}
