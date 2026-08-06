import { getPendaftarByNomor, getLombaById, getKategori, getSettings } from "@/lib/db";
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

  // Parallelize: cfg + pendaftar + kats are independent
  const [p, cfg, kats] = await Promise.all([
    getPendaftarByNomor(nomor),
    getSettings(),
    getKategori(),
  ]);
  const l = p ? await getLombaById(p.lombaId) : null;
  const k = p ? kats.find((kk) => kk.id === p.kategoriId) : null;

  return (
    <div className="mobile-page">
      {/* Match the public header — sticky red gradient with logo + back nav. */}
      <header className="app-header">
        <div className="header-content header-content-wide">
          <Link href="/" className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center" aria-label="Kembali ke daftar lomba">
            <i className="fas fa-arrow-left"></i>
          </Link>
          <div className="logo flex-1 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="Logo IPEKA" className="w-6 h-6 rounded-full object-cover inline-block mr-1.5 bg-white/10" />
            <span className="text-base font-bold">{cfg?.appName || "Lomba Kampung"}</span>
          </div>
          <span className="w-9"></span>
        </div>
      </header>

      <main className="app-content max-w-[600px] mx-auto w-full">
        <div className="text-center mb-6 pt-2">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center text-4xl mb-4 success-check-icon">
            <i className="fas fa-check"></i>
          </div>
          <h1 className="text-[22px] font-extrabold text-[#1F2937] mb-2">Pendaftaran Berhasil! 🎉</h1>
          <p className="text-[#6B7280] text-sm leading-relaxed">
            Bukti pendaftaran Anda sudah tersimpan. Tunjukkan kartu ini di lokasi lomba.
          </p>
        </div>

        <div className="kartu-peserta w-full max-w-[420px] mx-auto bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-primary">
          <div className="bg-gradient-to-br from-primary to-primary-dark text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.webp" alt="Logo IPEKA" className="w-5 h-5 rounded-full object-cover" />
              <span>KARTU PESERTA</span>
            </div>
            <span className="bg-accent text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">HUT RI 81</span>
          </div>

          <div className="p-5">
            <div className="text-[10px] text-[#6B7280] tracking-wider">NOMOR PENDAFTARAN</div>
            <div className="font-mono text-lg font-bold text-primary mb-3.5">{nomor}</div>

            {p ? (
              <>
                <div className="text-base font-bold text-[#1F2937] mb-3.5 border-b-2 border-dashed border-[#E5E7EB] pb-3.5 break-words">
                  {p.nama}
                </div>
                <div className="flex flex-col gap-2.5 text-xs leading-relaxed">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#6B7280]">Lomba</span>
                    <span className="font-semibold text-right break-words">
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
            ) : (
              <div className="text-sm text-[#6B7280] italic text-center py-3">
                Data pendaftar tidak ditemukan. Hubungi PJ lomba.
              </div>
            )}
          </div>

          <div className="bg-[#F9FAFB] p-3.5 text-center text-[10px] text-[#9CA3AF] italic border-t border-[#E5E7EB]">
            "Merdeka atau Mati!" — Panitia 17 Agustus Kampung Merdeka
          </div>
        </div>

        <div className="flex gap-2.5 w-full max-w-[420px] mx-auto my-5">
          <PrintButton />
        </div>

        <div className="text-center">
          <Link href="/" className="btn btn-ghost inline-flex">
            <i className="fas fa-arrow-left"></i> Kembali ke daftar lomba
          </Link>
        </div>
      </main>
    </div>
  );
}
