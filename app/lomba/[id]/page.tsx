import { getLombaById, getKategori, groupPendaftarForLomba, type DisplaySection } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInitials } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LombaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (isNaN(idNum)) notFound();
  const l = await getLombaById(idNum);
  if (!l || l.status !== "aktif") notFound();
  const kats = await getKategori();
  const katMap = new Map(kats.map((k) => [k.id, k]));
  const groups = await groupPendaftarForLomba(idNum);
  // PJ entries in the order of kategoriEligible (so urutan is predictable)
  const pjEntries = (l.kategoriEligible || [])
    .map((katId) => [katId, l.pjByKategori?.[katId]] as const)
    .filter(([, pj]) => pj != null) as Array<[string, { nama: string; kontak: string | null }]>;

  const totalPeserta = groups.sections.reduce((sum, s) => sum + s.peserta.length, 0);

  return (
    <div className="mobile-page">
      <div className="detail-hero">
        <Link href="/" className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center">
          <i className="fas fa-arrow-left"></i>
        </Link>
        <span className="text-6xl block mb-3">{l.emoji}</span>
        <h1 className="text-[22px] font-extrabold mb-1">{l.nama}</h1>
        <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-[11px] font-semibold">
          {l.kategoriEligible.map((k) => katMap.get(k)?.nama).filter(Boolean).join(" · ")}
        </span>
      </div>

      <main className="app-content">
        {l.deskripsi && <p className="text-sm text-[#1F2937] mb-4 px-1 leading-relaxed">{l.deskripsi}</p>}

        <div className="info-section">
          <h3 className="text-[13px] font-bold mb-3 text-[#1F2937] flex items-center gap-2">
            <i className="fas fa-clipboard-list text-primary"></i> Syarat & Ketentuan
          </h3>
          <ul className="space-y-2.5 text-[13px] text-[#6B7280] list-none p-0 leading-relaxed">
            {(l.syarat || []).map((s, i) => (
              <li key={i} className="pl-5 relative">
                <span className="absolute left-0 text-[#15803D] font-bold">✓</span> {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="info-section">
          <h3 className="text-[13px] font-bold mb-3 text-[#1F2937] flex items-center gap-2">
            <i className="fas fa-user-tie text-primary"></i> Penanggung Jawab
            {pjEntries.length > 1 && (
              <span className="text-[10px] font-normal text-[#6B7280]">per kategori</span>
            )}
          </h3>
          <div className="space-y-2.5 mt-2">
            {pjEntries.map(([katId, pj]) => {
              const kat = katMap.get(katId);
              return (
                <div key={katId} className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {getInitials(pj.nama)}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
                    {kat && (
                      <div className="text-[10px] font-bold text-primary uppercase tracking-wide">{kat.nama}</div>
                    )}
                    <div className="font-semibold text-[13px] truncate">{pj.nama}</div>
                    {pj.kontak && <div className="text-[11px] text-[#6B7280]">{pj.kontak}</div>}
                  </div>
                  {pj.kontak && (
                    <a
                      href={`https://wa.me/${pj.kontak.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-[#25D366] text-white rounded-lg text-[12px] font-bold hover:bg-[#1ebe57] transition-all no-underline"
                      title={`Chat WhatsApp ${pj.nama}`}
                    >
                      <i className="fab fa-whatsapp text-base"></i>
                      <span>Chat</span>
                    </a>
                  )}
                </div>
              );
            })}
            {pjEntries.length === 0 && (
              <div className="text-center py-4 text-[#6B7280] text-sm">
                Belum ada PJ yang ditugaskan
              </div>
            )}
          </div>
        </div>

        {/* Peserta Terdaftar */}
        <div className="info-section">
          <h3 className="text-[13px] font-bold mb-3 text-[#1F2937] flex items-center gap-2">
            <i className="fas fa-users text-primary"></i> Peserta Terdaftar
            <span className="ml-auto text-[11px] font-normal text-[#6B7280]">{totalPeserta} orang</span>
          </h3>

          {totalPeserta === 0 ? (
            <div className="text-center py-8 text-[#6B7280] text-sm bg-[#F9FAFB] rounded-lg">
              <i className="fas fa-user-slash text-2xl mb-2 block text-[#D1D5DB]"></i>
              Belum ada peserta yang terdaftar.
            </div>
          ) : (
            <div className="space-y-4">
              {groups.sections.map((sec) => (
                <PesertaTable
                  key={sec.key}
                  title={sec.title}
                  icon={SECTION_ICON[sec.key]}
                  ageRange={sec.rangeLabel}
                  color={SECTION_COLOR[sec.key]}
                  data={sec.peserta}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <div className="sticky-cta">
        <Link href={`/lomba/${l.id}/daftar`} className="btn btn-primary btn-block">
          <i className="fas fa-pen-to-square"></i> Daftar Sekarang
        </Link>
      </div>
    </div>
  );
}

const SECTION_ICON: Record<DisplaySection["key"], string> = {
  balita: "fa-baby",
  anakL: "fa-child",
  anakP: "fa-child-dress",
  dewasa: "fa-user-tie",
};

const SECTION_COLOR: Record<DisplaySection["key"], "pink" | "blue" | "amber"> = {
  balita: "pink",
  anakL: "blue",
  anakP: "pink",
  dewasa: "amber",
};

function PesertaTable({
  title,
  icon,
  ageRange,
  color,
  data,
}: {
  title: string;
  icon: string;
  ageRange: string;
  color: "pink" | "blue" | "amber";
  data: { nama: string; umur: number }[];
}) {
  const colorClass: Record<typeof color, string> = {
    pink: "bg-[#FDF2F8] text-[#9D174D] border-[#FBCFE8]",
    blue: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
    amber: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
  };

  return (
    <div className={`rounded-lg border ${colorClass[color]} overflow-hidden`}>
      <div className="px-3.5 py-2.5 flex items-center gap-2 text-[12px] font-bold">
        <i className={`fas ${icon}`}></i>
        <span>{title}</span>
        <span className="font-normal opacity-70">· {ageRange}</span>
        <span className="ml-auto bg-white/60 px-2 py-0.5 rounded-full text-[11px]">{data.length} orang</span>
      </div>
      <div className="bg-white">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase text-[#6B7280] bg-[#F9FAFB]">
              <th className="text-left p-2.5 pl-3.5 w-[40px]">No</th>
              <th className="text-left p-2.5">Nama</th>
              <th className="text-right p-2.5 pr-3.5 w-[70px]">Umur</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={i} className="border-t border-[#F3F4F6]">
                <td className="p-2.5 pl-3.5 text-[#9CA3AF] font-mono">{i + 1}</td>
                <td className="p-2.5 font-semibold text-[#1F2937]">{p.nama}</td>
                <td className="p-2.5 pr-3.5 text-right">
                  <span className="inline-block bg-[#F3F4F6] px-2 py-0.5 rounded-full text-[11px] font-bold text-[#374151]">
                    {p.umur} th
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
