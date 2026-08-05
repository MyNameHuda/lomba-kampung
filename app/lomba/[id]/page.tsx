import {
  getLombaById,
  getKategori,
  groupPendaftarForLomba,
  getJuaraByLomba,
  getJuaraReadiness,
  getPendaftarByLomba,
  type DisplaySection,
} from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInitials } from "@/lib/format";
import { SECTION_ICON } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public-facing status derived from lomba.status + lomba.phase + Juara readiness.
// 6 variants (was 4 in v2 — added kualifikasi and final).
type PublicStatus =
  | "coming-soon"   // draft
  | "berlangsung"   // aktif + phase=NULL (legacy)
  | "kualifikasi"   // aktif + phase='kualifikasi' (picking finalists)
  | "final"         // aktif + phase='final' (picking Juara 1/2/3, partial)
  | "juara-terpilih"// allReady Juara (akhirnya atau sebelum Selesaikan)
  | "selesai";      // status='selesai'

export default async function LombaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (isNaN(idNum)) notFound();
  const l = await getLombaById(idNum);
  if (!l || l.status === "draft") notFound();

  // Parallelize: kats, groups, juara, readiness, pendaftar are all independent after `l`.
  // pendaftar is needed for the Finalis section (get full finalist data with umur/jk).
  const [kats, groups, juaraMap, readiness, allDisetujui] = await Promise.all([
    getKategori(),
    groupPendaftarForLomba(idNum),
    getJuaraByLomba(idNum),
    getJuaraReadiness(idNum),
    getPendaftarByLomba(idNum, "disetujui"),
  ]);
  const katMap = new Map(kats.map((k) => [k.id, k]));

  // Flatten pjByKategori into per-PJ entries (one row per PJ, multiple allowed per kategori).
  const pjEntries: Array<{ katId: string; pj: { nama: string; kontak: string | null } }> = [];
  for (const katId of (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])) {
    const list = l.pjByKategori?.[katId] || [];
    for (const pj of list) {
      if (pj?.nama) pjEntries.push({ katId, pj });
    }
  }

  const totalPeserta = groups.sections.reduce((sum, s) => sum + s.peserta.length, 0);

  // Public-facing status badge. 6 variants (v2 had 4). Priority:
  //   selesai > juara-terpilih > final > kualifikasi > berlangsung > coming-soon
  const totalJuara = Object.values(juaraMap).reduce((sum, arr) => sum + arr.length, 0);
  const publicStatus: PublicStatus =
    l.status === "selesai"
      ? "selesai"
      : readiness.allReady && totalJuara > 0
      ? "juara-terpilih"
      : l.phase === "final"
      ? "final"
      : l.phase === "kualifikasi"
      ? "kualifikasi"
      : "berlangsung";

  // Finalis名单 — for each eligible kategori, collect finalists (those with
  // juara_rank 1..finalisCount). Build a quick lookup: pendaftarId → Juara rank
  // (1, 2, 3 if Juara, else 1..finalisCount for finalists without Juara).
  const finalisByKategori: Record<string, Array<{
    pendaftarId: number;
    nama: string;
    umur: number;
    jenisKelamin: "L" | "P";
    juaraRank: number | null; // 1, 2, 3 if Juara; 1..finalisCount for non-Juara finalists
  }>> = {};

  // Map: pendaftarId → Juara rank (1, 2, 3 only) from getJuaraByLomba
  const juaraRankById = new Map<number, number>();
  for (const arr of Object.values(juaraMap)) {
    for (const j of arr) juaraRankById.set(j.pendaftarId, j.juaraRank);
  }

  for (const katId of (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])) {
    const finalists = allDisetujui
      .filter((p) => p.kategoriId === katId)
      .map((p) => ({
        pendaftarId: p.id,
        nama: p.nama,
        umur: p.umur,
        jenisKelamin: p.jenisKelamin,
        // Use Juara rank (1,2,3) if picked, else fall back to the kualifikasi
        // rank value (1..finalisCount) so the UI can sort consistently.
        juaraRank: juaraRankById.get(p.id) ?? ((p.juaraRank as number | null) ?? null),
      }))
      .filter((f) => f.juaraRank !== null && f.juaraRank <= l.finalisCount)
      // Sort: Juara 1/2/3 first (by rank ASC), then non-Juara finalists by umur ASC
      .sort((a, b) => {
        const aIsJuara = a.juaraRank! <= 3 ? 0 : 1;
        const bIsJuara = b.juaraRank! <= 3 ? 0 : 1;
        if (aIsJuara !== bIsJuara) return aIsJuara - bIsJuara;
        if (aIsJuara === 0) return a.juaraRank! - b.juaraRank!; // Juara 1, 2, 3 in order
        return a.umur - b.umur; // finalists: younger first
      });
    finalisByKategori[katId] = finalists;
  }

  // Total finalists across all kategori
  const totalFinalis = Object.values(finalisByKategori).reduce((sum, arr) => sum + arr.length, 0);
  // Show finalis section when: phase=final OR status=selesai (i.e. Juara picking started)
  // AND we have at least 1 finalist. Per spec: TIDAK tampil during kualifikasi.
  const showFinalis = (l.phase === "final" || l.status === "selesai") && totalFinalis > 0;

  return (
    <div className="mobile-page">
      <div className="detail-hero">
        <Link href="/" className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center">
          <i className="fas fa-arrow-left"></i>
        </Link>
        <span className="text-6xl block mb-3">{l.emoji}</span>
        <h1 className="text-[22px] font-extrabold mb-1">{l.nama}</h1>
        <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-[11px] font-semibold mb-2">
          {l.kategoriEligible.map((k) => katMap.get(k)?.nama).filter(Boolean).join(" · ")}
        </span>
        <PublicStatusBadge status={publicStatus} />
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
            {(() => {
              const katCount = new Set(pjEntries.map((e) => e.katId)).size;
              return katCount > 1 ? (
                <span className="text-[10px] font-normal text-[#6B7280]">per kategori</span>
              ) : null;
            })()}
          </h3>
          <div className="space-y-2.5 mt-2">
            {pjEntries.map(({ katId, pj }, idx) => {
              const kat = katMap.get(katId);
              const prevEntry = idx > 0 ? pjEntries[idx - 1] : null;
              const showKatLabel = !prevEntry || prevEntry.katId !== katId;
              return (
                <div key={`${katId}-${idx}`} className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {getInitials(pj.nama)}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
                    {showKatLabel && kat && (
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

        {/* Finalis section — replaces v2 Juara section. Shows during final phase
            and after selesai. Juara 1/2/3 get gold/silver/bronze + "Juara N" label,
            other finalists get plain "Finalis" label. Per-kategori blocks. */}
        {showFinalis && (
          <div className="info-section">
            <h3 className="text-[13px] font-bold mb-3 text-[#1F2937] flex items-center gap-2">
              <i className="fas fa-trophy text-[#FFD700]"></i> Finalis
              <span className="ml-auto text-[11px] font-normal text-[#6B7280]">
                {totalFinalis} orang
              </span>
            </h3>
            <div className="space-y-3">
              {Array.isArray(l.kategoriEligible) ? l.kategoriEligible.map((kid) => {
                const finalists = finalisByKategori[kid] || [];
                if (finalists.length === 0) return null;
                const kat = katMap.get(kid);
                return (
                  <div key={kid} className="juara-public-block">
                    <div className="juara-public-header" style={{ borderLeftColor: kat?.colorBorder || "#E11D1D" }}>
                      {kat?.nama || kid}
                    </div>
                    <div className="juara-public-list">
                      {finalists.map((f) => {
                        // Determine if this finalist is also a Juara (rank 1, 2, or 3)
                        const isJuara = f.juaraRank !== null && f.juaraRank <= 3;
                        const rowClass = isJuara ? `juara-public-row rank-${f.juaraRank}` : "juara-public-row";
                        return (
                          <div key={f.pendaftarId} className={rowClass}>
                            <span className="juara-medal-icon">
                              {isJuara
                                ? (f.juaraRank === 1 ? "🥇" : f.juaraRank === 2 ? "🥈" : "🥉")
                                : "👥"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="juara-public-nama">{f.nama}</div>
                              <div className="juara-public-meta">
                                {f.jenisKelamin === "L" ? "♂ Laki-laki" : "♀ Perempuan"} · {f.umur} tahun
                              </div>
                            </div>
                            {isJuara ? (
                              <span className={`juara-public-label rank-${f.juaraRank}`}>
                                Juara {f.juaraRank}
                              </span>
                            ) : (
                              <span className="juara-public-label" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                                Finalis
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }) : null}
            </div>
          </div>
        )}

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
                  color={sec.key}
                  data={sec.peserta}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* CTA — only show for aktif lomba (not selesai) */}
      {l.status === "aktif" && (
        <div className="sticky-cta">
          <Link href={`/lomba/${l.id}/daftar`} className="btn btn-primary btn-block">
            <i className="fas fa-pen-to-square"></i> Daftar Sekarang
          </Link>
        </div>
      )}
    </div>
  );
}

// =================== Public status badge ===================
// Derive from lomba.status + lomba.phase + Juara readiness. 6 variants for warga.
function PublicStatusBadge({ status }: { status: PublicStatus }) {
  const config: Record<PublicStatus, { label: string; icon: string; className: string }> = {
    "coming-soon": { label: "Coming Soon", icon: "fa-clock", className: "bg-white/20 text-white" },
    "berlangsung": { label: "Sedang Berlangsung", icon: "fa-circle-play", className: "bg-[#FBBF24] text-[#92400E]" },
    "kualifikasi": { label: "Tahap Kualifikasi", icon: "fa-filter", className: "bg-[#FBBF24] text-[#92400E]" },
    "final": { label: "Tahap Final", icon: "fa-star", className: "bg-[#F97316] text-white" },
    "juara-terpilih": { label: "Juara Terpilih!", icon: "fa-trophy", className: "bg-[#3B82F6] text-white" },
    "selesai": { label: "Selesai", icon: "fa-check-circle", className: "bg-[#22C55E] text-white" },
  };
  const c = config[status];
  return (
    <span className={`public-status-badge ${c.className}`}>
      <i className={`fas ${c.icon}`}></i> {c.label}
    </span>
  );
}

// Section keys with matching tailwind color classes (combines bg/text/border)
const SECTION_COLOR_CLASS: Record<DisplaySection["key"], string> = {
  balita: "bg-[#FDF2F8] text-[#9D174D] border-[#FBCFE8]",
  anakL: "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]",
  anakP: "bg-[#FDF2F8] text-[#9D174D] border-[#FBCFE8]",
  dewasa: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
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
  color: DisplaySection["key"];
  data: { nama: string; umur: number }[];
}) {
  return (
    <div className={`rounded-lg border ${SECTION_COLOR_CLASS[color]} overflow-hidden`}>
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
