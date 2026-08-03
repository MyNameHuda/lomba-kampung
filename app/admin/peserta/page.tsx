import AdminShell from "@/components/admin-shell";
import { getLomba, countPendaftarByLomba, countPendaftarHadir } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PesertaListPage() {
  const rows = await getLomba(true);

  // Pre-compute counts for all lomba in parallel (avoids N+1)
  const counts = await Promise.all(
    rows.map(async (l) => ({
      id: l.id,
      total: await countPendaftarByLomba(l.id),
      disetujui: await countPendaftarByLomba(l.id, "disetujui"),
      hadir: await countPendaftarHadir(l.id),
    }))
  );
  const countById = new Map(counts.map((c) => [c.id, c]));

  return (
    <AdminShell title="Manajemen Peserta" breadcrumb="Manajemen Peserta" activeNav="/admin/peserta">
      <p className="text-[13px] text-[#6B7280] mb-5 leading-relaxed">Pilih lomba untuk mengelola peserta (tandai hadir, export Excel)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((l) => {
          const c = countById.get(l.id);
          return (
            <Link key={l.id} href={`/admin/peserta/${l.id}`} className="card p-5 no-underline text-inherit hover:border-primary transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl leading-none">{l.emoji}</div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
                  <div className="font-bold text-[15px]">{l.nama}</div>
                  <div className="text-[11px] text-[#6B7280]">Klik untuk kelola peserta</div>
                </div>
                <i className="fas fa-chevron-right text-[#9CA3AF]"></i>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="flex flex-col gap-0.5">
                  <div className="text-[20px] font-extrabold leading-tight">{c?.total ?? 0}</div>
                  <div className="text-[10px] text-[#6B7280]">Total</div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="text-[20px] font-extrabold leading-tight text-[#15803D]">{c?.disetujui ?? 0}</div>
                  <div className="text-[10px] text-[#6B7280]">Disetujui</div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="text-[20px] font-extrabold leading-tight text-[#1E40AF]">{c?.hadir ?? 0}</div>
                  <div className="text-[10px] text-[#6B7280]">Hadir</div>
                </div>
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div className="col-span-2 text-center py-8 text-[#6B7280]">Belum ada lomba.</div>
        )}
      </div>
    </AdminShell>
  );
}
