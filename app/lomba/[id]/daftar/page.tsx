import { getLombaById, getKategori } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import DaftarForm from "./daftar-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DaftarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (isNaN(idNum)) notFound();

  const l = await getLombaById(idNum);
  if (!l || l.status !== "aktif") notFound();

  // Only pass kategori that this lomba is eligible for.
  // Backend API also validates, but showing irrelevant options is bad UX.
  const allKats = await getKategori();
  const eligibleSet = new Set(l.kategoriEligible);
  const kats = allKats.filter((k) => eligibleSet.has(k.id));

  // If admin closed public registration, show a closed message instead of
  // the form. The API also rejects (403), but doing the check at the page
  // level gives a friendlier UX with no client-side 403 flash.
  if (!l.pendaftaranDibuka) {
    return (
      <div className="mobile-page">
        <header className="app-header">
          <div className="header-content">
            <Link href={`/lomba/${l.id}`} className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center" aria-label="Kembali">
              <i className="fas fa-arrow-left"></i>
            </Link>
            <h1 className="flex-1 text-center text-base font-bold">Pendaftaran Ditutup</h1>
            <span className="w-9"></span>
          </div>
        </header>
        <main className="app-content max-w-[600px] mx-auto">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#FEE2E2] text-[#E11D1D] flex items-center justify-center text-3xl">
              <i className="fas fa-lock"></i>
            </div>
            <h2 className="text-lg font-bold text-[#1F2937] mb-2">Pendaftaran Sudah Ditutup</h2>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-6">
              Pendaftaran publik untuk lomba ini sudah ditutup oleh panitia. Hubungi PJ lomba untuk info lebih lanjut, atau kembali ke halaman lomba.
            </p>
            <Link href={`/lomba/${l.id}`} className="btn btn-primary inline-flex">
              <i className="fas fa-arrow-left"></i> Kembali ke Detail Lomba
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <DaftarForm lomba={l} kategori={kats} />;
}
