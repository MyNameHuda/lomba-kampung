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
import { formatTanggalLomba, lombaTimeStatus, juaraLabel, displayKategoriName, type LombaTimeStatus } from "@/lib/format";
import { SECTION_ICON } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public-facing status derived from lomba.status + lomba.phase + Juara readiness
// + per-kategori tanggal (time-based). 9 variants for warga.
type PublicStatus =
  | "coming-soon"   // draft
  | "berlangsung"   // aktif + phase=NULL OR time=today
  | "kualifikasi"   // aktif + phase='kualifikasi' (picking finalists)
  | "final"         // aktif + phase='final' (picking Juara 1/2/3, partial)
  | "juara-terpilih"// allReady Juara (akhirnya atau sebelum Selesaikan)
  | "selesai"       // admin marked Selesai
  | "akan-datang"   // time=future (tanggal belum tiba)
  | "lewat-jadwal"  // time=past (semua tanggal udah lewat, admin belum Selesai)
  | "belum-mulai";  // aktif + no tanggal + no pendaftar (neutral — buka, tapi belum ada yg daftar/jadwal)

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

  // Public-facing status badge. v4: phase + time-based status.
  // Time-based (akan-datang / sedang-berlangsung / lewat-jadwal) wins when
  // lomba.status = "aktif" so warga get a calendar-aware "what's happening
  // now" view. Admin clicks Selesai → status pins to "selesai".
  const totalJuara = Object.values(juaraMap).reduce((sum, arr) => sum + arr.length, 0);
  // Derive global phase from per-kategori tutup state
  const eligibleKategori = Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [];
  const tutupMap = l.kategoriTutupAt || {};
  const allKategoriTutup = eligibleKategori.length > 0 && eligibleKategori.every((kid) => !!tutupMap[kid]);
  const anyKategoriTutup = eligibleKategori.some((kid) => !!tutupMap[kid]);
  const hasPendaftar = totalPeserta > 0;
  // v4: Juara 1+2 readiness
  const showJuaraTerpilih = readiness.allReady && totalJuara > 0;
  // Time-based status (only when lomba is active/draft, not Selesai)
  const timeStatus: LombaTimeStatus =
    l.status === "aktif"
      ? lombaTimeStatus(l.jadwalByKategori, eligibleKategori)
      : "belum-dijadwalkan";
  const publicStatus: PublicStatus =
    l.status === "selesai"
      ? "selesai"
      : showJuaraTerpilih
      ? "juara-terpilih"
      : timeStatus === "akan-datang"
      ? "akan-datang"
      : timeStatus === "sedang-berlangsung"
      ? "berlangsung"
      : timeStatus === "lewat-jadwal"
      ? "lewat-jadwal"
      : allKategoriTutup
      ? "final"
      : anyKategoriTutup
      ? "final"  // some kategori in final phase
      : hasPendaftar && eligibleKategori.length > 0
      ? "kualifikasi"
      : "belum-mulai"; // fallback: aktif, no tanggal, no pendaftar

  // Finalis名单 — for each eligible kategori, collect finalists (is_finalist = 1).
  const finalisByKategori: Record<string, Array<{
    pendaftarId: number;
    nama: string;
    umur: number;
    jenisKelamin: "L" | "P";
    juaraRank: number | null; // 1, 2, 3 if Juara; null if just finalist
    kategoriId: string;        // original sub-kategori (k_anak_l / k_anak_p / k_balita / k_dewasa_p)
  }>> = {};

  // Map: pendaftarId → Juara rank (1, 2, 3 only) from getJuaraByLomba
  const juaraRankById = new Map<number, number>();
  for (const arr of Object.values(juaraMap)) {
    for (const j of arr) juaraRankById.set(j.pendaftarId, j.juaraRank);
  }

  for (const katId of eligibleKategori) {
    const finalists = allDisetujui
      .filter((p) => p.kategoriId === katId && p.isFinalist === 1)
      .map((p) => ({
        pendaftarId: p.id,
        nama: p.nama,
        umur: p.umur,
        jenisKelamin: p.jenisKelamin,
        juaraRank: juaraRankById.get(p.id) ?? null,
        // Track original sub-kategori so the public juaraLabel call
        // (which still uses kategoriId for the optional admin suffix)
        // has the right context. On public we pass forPublic=true so
        // the gender suffix is dropped regardless of this value.
        kategoriId: katId,
      }))
      // Sort: Juara 1/2/3 first (by rank ASC), then non-Juara finalists by umur ASC
      .sort((a, b) => {
        const aIsJuara = a.juaraRank !== null ? 0 : 1;
        const bIsJuara = b.juaraRank !== null ? 0 : 1;
        if (aIsJuara !== bIsJuara) return aIsJuara - bIsJuara;
        if (aIsJuara === 0 && bIsJuara === 0) return a.juaraRank! - b.juaraRank!;
        return a.umur - b.umur;
      });
    finalisByKategori[katId] = finalists;
  }

  // Total finalists across all kategori
  const totalFinalis = Object.values(finalisByKategori).reduce((sum, arr) => sum + arr.length, 0);
  // Show finalis section when: at least 1 kategori is Tutup (kualifikasi done for that kategori)
  // AND we have at least 1 finalist. Per spec: TIDAK tampil during full kualifikasi.
  const showFinalis = anyKategoriTutup && totalFinalis > 0;

  return (
    <div className="mobile-page">
      <div className="detail-hero">
        <Link href="/" className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center" aria-label="Kembali ke daftar lomba">
          <i className="fas fa-arrow-left"></i>
        </Link>
        <div className="detail-hero-content">
          <span className="text-6xl block mb-3">{l.emoji}</span>
          <h1 className="text-[22px] font-extrabold mb-1">{l.nama}</h1>
          <div className="flex flex-col items-center gap-3 mb-2">
            <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-[11px] font-semibold">
              {/* Show per-kategori (k_anak_l + k_anak_p shown as separate
                  "Anak (Laki-laki)" / "Anak (Perempuan)") on the detail page
                  so Juara 1/2/3 for L and P can be distinguished. Home
                  page collapses to a single "Anak" via publicKategoriName. */}
              {l.kategoriEligible.map((k) => katMap.get(k)?.nama).filter(Boolean).join(" · ")}
            </span>
            <PublicStatusBadge status={publicStatus} />
          </div>
        </div>
      </div>

      <main className="app-content max-w-[1100px] mx-auto w-full">
        {l.deskripsi && (
          // Deskripsi callout — visually distinct from white info-sections
          // (Syarat/Jadwal/PJ). Soft pink gradient + decorative quote icon
          // + "Tentang Lomba" eyebrow label so warga won't skip it.
          <div className="relative mb-5 p-4 sm:p-5 rounded-2xl border border-[#FCE0E0] bg-gradient-to-br from-[#FCE0E0]/60 via-[#FDF5F5] to-white shadow-sm overflow-hidden">
            <i className="fas fa-quote-left absolute top-3 right-4 text-2xl text-primary opacity-20" aria-hidden="true"></i>
            <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <i className="fas fa-book-open text-[10px]"></i> Tentang Lomba
            </div>
            <p className="text-[14px] text-[#1F2937] leading-relaxed break-words relative z-[1]">
              {l.deskripsi}
            </p>
          </div>
        )}

        <div className="detail-2col grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="space-y-3.5">
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
                <i className="far fa-calendar text-primary"></i> Jadwal Pelaksanaan
              </h3>
              {(() => {
                // Group eligible kategori by public name so k_anak_l +
                // k_anak_p collapse into a single "Anak" jadwal card
                // (matches the PJ section right below). For each group
                // we collect all jadwals across its katIds; if both
                // genders share the same tanggal the card shows one
                // date, if they differ we list each on its own line
                // (weekday-long format is verbose so " & " join is too
                // dense — separate lines are easier to scan).
                type JadwalGroup = {
                  publicName: string;
                  jadwals: Array<{ tanggal: number; jam: string | null }>;
                };
                const seen = new Map<string, JadwalGroup & { sampleKat?: ReturnType<typeof katMap.get> }>();
                const ordered: Array<JadwalGroup & { sampleKat?: ReturnType<typeof katMap.get> }> = [];
                for (const kid of (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])) {
                  const sampleKat = katMap.get(kid);
                  // displayKategoriName collapses k_anak_l + k_anak_p → "Anak";
                  // for any other kat (including user-added k_<timestamp> ids)
                  // it returns the real DB nama so the card header shows
                  // "Umum" instead of the raw id.
                  const publicName = displayKategoriName(kid, sampleKat);
                  let g = seen.get(publicName);
                  if (!g) {
                    g = { publicName, sampleKat: katMap.get(kid), jadwals: [] };
                    seen.set(publicName, g);
                    ordered.push(g);
                  }
                  const j = l.jadwalByKategori?.[kid];
                  if (j && j.tanggal != null) {
                    g.jadwals.push({ tanggal: j.tanggal, jam: j.jam });
                  }
                }
                const withJadwal = ordered.filter((g) => g.jadwals.length > 0);
                if (withJadwal.length === 0) {
                  return <div className="text-center py-3 text-[#6B7280] text-sm">Belum ada jadwal yang diumumkan</div>;
                }
                return (
                  <div className="space-y-2.5 mt-2">
                    {withJadwal.map((g) => {
                      const allSameDate = g.jadwals.every((j) => j.tanggal === g.jadwals[0].tanggal);
                      const uniqueDates = Array.from(new Set(g.jadwals.map((j) => j.tanggal)));
                      const uniqueJams = Array.from(
                        new Set(g.jadwals.map((j) => j.jam).filter((j): j is string => !!j))
                      );
                      return (
                        <div key={g.publicName} className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center flex-shrink-0">
                            <i className="far fa-calendar text-base"></i>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
                            <div className="text-[10px] font-bold text-primary uppercase tracking-wide">
                              {g.publicName}
                            </div>
                            {allSameDate ? (
                              <div className="font-semibold text-[13px]">
                                {formatTanggalLomba(g.jadwals[0].tanggal, "weekday-long")}
                              </div>
                            ) : (
                              <div className="font-semibold text-[13px] flex flex-col gap-0.5">
                                {uniqueDates.map((t) => (
                                  <span key={t}>{formatTanggalLomba(t, "weekday-long")}</span>
                                ))}
                              </div>
                            )}
                            {uniqueJams.length > 0 && (
                              <div className="text-[11px] text-[#6B7280]">
                                Pukul {uniqueJams.join(", ")} WIB
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
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
            <div className="space-y-3 mt-2">
              {(() => {
                // Group PJ entries by PUBLIC name so k_anak_l + k_anak_p
                // collapse into a single "Anak" section (same PJs handle
                // both genders — showing 2 lists of identical names is
                // redundant for warga). Juara 1/2/3 distinction is
                // preserved on the Finalis section (separate L/P blocks
                // there). PJs are deduplicated by nama within a group.
                type PjGroup = {
                  publicName: string;
                  sampleKat: ReturnType<typeof katMap.get>;
                  pjs: Array<{ nama: string; kontak: string | null }>;
                };
                const seen = new Map<string, PjGroup>();
                const ordered: PjGroup[] = [];
                for (const kid of (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])) {
                  const kat = katMap.get(kid);
                  if (!kat) continue;
                  const pjs = pjEntries.filter((e) => e.katId === kid).map((e) => e.pj);
                  if (pjs.length === 0) continue;
                  // displayKategoriName collapses k_anak_l + k_anak_p → "Anak";
                  // for any other kat it returns the real DB nama so the
                  // section header shows "Umum" instead of the raw id.
                  const publicName = displayKategoriName(kid, kat);
                  let group = seen.get(publicName);
                  if (!group) {
                    group = { publicName, sampleKat: kat, pjs: [] };
                    seen.set(publicName, group);
                    ordered.push(group);
                  }
                  // Use sampleKat from the first encountered kid (L or P)
                  // — colors are usually identical or close enough; user
                  // only sees a single combined block.
                  for (const pj of pjs) {
                    if (!group.pjs.some((p) => p.nama === pj.nama)) {
                      group.pjs.push(pj);
                    }
                  }
                }
                if (ordered.length === 0) {
                  return (
                    <div className="text-center py-4 text-[#6B7280] text-sm">
                      Belum ada PJ yang ditugaskan
                    </div>
                  );
                }
                return ordered.map((g) => (
                  <div key={g.publicName} className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                    <div
                      className="px-3.5 py-2 text-[11px] font-bold text-primary uppercase tracking-wide"
                      style={{
                        background: g.sampleKat?.colorBg || "#F9FAFB",
                        color: g.sampleKat?.colorText || "#92400E",
                        borderBottom: `1px solid ${g.sampleKat?.colorBorder || "#E5E7EB"}`,
                      }}
                    >
                      <i className="fas fa-tag"></i> {g.publicName}
                      <span className="ml-2 text-[10px] font-normal opacity-80 normal-case">{g.pjs.length} PJ</span>
                    </div>
                    <div className="divide-y divide-[#F3F4F6]">
                      {g.pjs.map((pj, pjIdx) => (
                        <div key={pjIdx} className="flex items-center gap-3 p-3 bg-white">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {getInitials(pj.nama)}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
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
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Finalis section — shows during final phase and after selesai.
            Per-kategori blocks so k_anak_l + k_anak_p show as separate
            "Anak (Laki-laki)" / "Anak (Perempuan)" sections, each with its
            own Juara 1/2/3 (with gender suffix for clarity). Other finalists
            get plain "Finalis" label. */}
        {showFinalis && (
          <div className="info-section mt-3.5">
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
                                {/* forPublic=false → gender suffix ("Juara 1 (Laki-laki)" /
                                    "Juara 1 (Perempuan)"). Detail page needs the
                                    distinction so warga can see L vs P winners
                                    explicitly. Home + success pages use
                                    publicKategoriName() to collapse instead. */}
                                {juaraLabel(kid, f.juaraRank as 1 | 2 | 3, false)}
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

        {/* Peserta Terdaftar — per-kategori sections (Balita, Anak Laki-laki,
            Anak Perempuan, Dewasa) so Juara 1/2/3 for each can be
            distinguished. The sections come from the master kategori table
            via groupPendaftarForLomba (key: balita/anakL/anakP/dewasa). */}
        <div className="info-section mt-3.5">
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

      {/* CTA — only for aktif lomba, and only when admin hasn't closed registration */}
      {l.status === "aktif" && l.pendaftaranDibuka && (
        <div className="sticky-cta-wrap">
          <div className="sticky-cta-inner max-w-[1100px] mx-auto">
            <Link href={`/lomba/${l.id}/daftar`} className="btn btn-primary btn-block">
              <i className="fas fa-pen-to-square"></i> Daftar Sekarang
            </Link>
          </div>
        </div>
      )}
      {/* Show "Pendaftaran Ditutup" notice instead of CTA when admin closed it */}
      {l.status === "aktif" && !l.pendaftaranDibuka && (
        <div className="sticky-cta-wrap">
          <div className="sticky-cta-inner max-w-[1100px] mx-auto">
            <div className="bg-[#FEE2E2] text-[#991B1B] rounded-xl p-3 text-center text-[13px] font-semibold flex items-center justify-center gap-2">
              <i className="fas fa-lock"></i> Pendaftaran Ditutup oleh Panitia
            </div>
          </div>
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
    "akan-datang": { label: "Akan Datang", icon: "fa-calendar-plus", className: "bg-[#8B5CF6] text-white" },
    "lewat-jadwal": { label: "Lewat Jadwal", icon: "fa-calendar-xmark", className: "bg-[#6B7280] text-white" },
    "belum-mulai": { label: "Belum Mulai", icon: "fa-circle-dot", className: "bg-white/30 text-white" },
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
