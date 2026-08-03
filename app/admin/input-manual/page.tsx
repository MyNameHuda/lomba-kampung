import AdminShell from "@/components/admin-shell";
import InputManualClient from "./input-manual-client";
import { getLomba, getKategori, getPendaftar } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InputManualPage() {
  const lomList = await getLomba(true);
  const kats = await getKategori();
  const allRecent = await getPendaftar();
  const recent = allRecent
    .filter((p) => p.sumber === "manual")
    .slice(0, 5);

  const recentData = recent.map((r) => {
    const l = lomList.find((ll) => ll.id === r.lombaId);
    return {
      id: r.id,
      nama: r.nama,
      lombaEmoji: l?.emoji || "❓",
      lombaNama: l?.nama || "—",
      status: r.status,
      createdAt: new Date(r.createdAt * 1000).toISOString(),
    };
  });

  return (
    <AdminShell title="Input Peserta Manual" breadcrumb="Input Manual" activeNav="/admin/input-manual">
      <InputManualClient lombaList={lomList} kats={kats} recent={recentData} />
    </AdminShell>
  );
}
