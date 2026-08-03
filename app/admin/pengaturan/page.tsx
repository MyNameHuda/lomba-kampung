import AdminShell from "@/components/admin-shell";
import PengaturanClient from "./pengaturan-client";
import { getSettings, getKategori } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PengaturanPage() {
  const s = await getSettings();
  const kats = await getKategori();

  return (
    <AdminShell title="Pengaturan Aplikasi" breadcrumb="Pengaturan" activeNav="/admin/pengaturan">
      <PengaturanClient
        settings={s ? { appName: s.appName, kampungName: s.kampungName, tahunAktif: s.tahunAktif } : null}
        kategori={kats}
      />
    </AdminShell>
  );
}
