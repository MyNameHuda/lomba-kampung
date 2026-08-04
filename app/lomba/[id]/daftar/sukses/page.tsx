import { getPendaftarByNomor, getLombaById, getKategori } from "@/lib/db";
import Link from "next/link";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SuksesPage({ searchParams }: { searchParams: Promise<{ nomor?: string }> }) {
  return <SuksesContent searchParamsPromise={searchParams} />;
}

async function SuksesContent({ searchParamsPromise }: { searchParamsPromise: Promise<{ nomor?: string }> }) {
  const sp = await searchParamsPromise;
  const nomor = sp.nomor || "LMB-XXXX";

  const p = await getPendaftarByNomor(nomor);
  const l = p ? await getLombaById(p.lombaId) : null;
  const kats = await getKategori();
  const k = p ? kats.find((kk) => kk.id === p.kategoriId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FCE0E0] to-[#f5fbfc] flex flex-col text-sm">
      <header className="bg-white/80 backdrop-blur py-4 flex items-center justify-center">
        <div className="flex items-center gap-2 text-primary font-bold">
          <i className="fas fa-flag"></i>
          <span>Lomba Kampung</span>
        </div>
      </header>

      <main className="flex-1 px-5 py-7 flex flex-col items-center max-w-md mx-auto w-full">
        <div className="w-20 h-20 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center text-4xl my-6">
          <i className="fas fa-check"></i>
        </div>

        <h1 className="text-xl font-extrabold text-center mb-2">Pendaftaran Berhasil! 🎉</h1>
        <p className="text-[#6B7280] text-center text-sm mb-6 leading-relaxed">
          Bukti pendaftaran Anda sudah tersimpan. Tunjukkan kartu ini di lokasi lomba.
        </p>

        <div className="w-full max-w-[340px] bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-primary">
          <div className="bg-gradient-to-br from-primary to-primary-dark text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <i className="fas fa-flag"></i>
              <span>KARTU PESERTA</span>
            </div>
            <span className="bg-accent text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">HUT RI 81</span>
          </div>

          <div className="p-5">
            <div className="text-[10px] text-[#6B7280] tracking-wider">NOMOR PENDAFTARAN</div>
            <div className="font-mono text-lg font-bold text-primary mb-3.5">{nomor}</div>

            {p && (
              <>
                <div className="text-base font-bold text-[#1F2937] mb-3.5 border-b-2 border-dashed border-[#E5E7EB] pb-3.5">
                  {p.nama}
                </div>
                <div className="flex flex-col gap-2.5 text-xs leading-relaxed">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#6B7280]">Lomba</span>
                    <span className="font-semibold text-right">
                      {l?.emoji} {l?.nama}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#6B7280]">Kategori</span>
                    <span className="font-semibold">{k?.nama} ({p.umur} th)</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#6B7280]">Status</span>
                    <span className="font-semibold text-[#B45309]">⏳ Menunggu Verifikasi</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-[#F9FAFB] p-3.5 text-center text-[10px] text-[#9CA3AF] italic border-t border-[#E5E7EB]">
            "Merdeka atau Mati!" — Panitia 17 Agustus Kampung Merdeka
          </div>
        </div>

        <div className="flex gap-2.5 w-full max-w-[340px] my-5">
          <PrintButton />
        </div>

        <Link href="/" className="btn btn-ghost">
          <i className="fas fa-arrow-left"></i> Kembali ke daftar lomba
        </Link>
      </main>
    </div>
  );
}
