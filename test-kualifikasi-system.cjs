// Full E2E test for stage system v3 (kualifikasi + Juara).
// Covers the full lifecycle from the public lens, including sort order
// verification and all 5 badge variants. Complements test-kualifikasi-ui.cjs
// (which covers admin picker UI) and test-juara-system.cjs (Juara v2).
//
// Flow:
//   1. Login + create test lomba (k_anak, finalisCount=3)
//   2. Create 5 pendaftar (so 2 are non-finalists in kualifikasi)
//   3. Verify public display: "Sedang Berlangsung" badge, no Finalis section
//   4. Mulai Kualifikasi → verify "Tahap Kualifikasi" badge, no Finalis section
//   5. Set 3 finalists (rank 1, 2, 3) via API
//   6. Verify sort: rank 1, 2, 3 in order, public still no Finalis section
//   7. Tutup Kualifikasi → verify "Tahap Final" badge, Finalis section visible
//   8. Set Juara 1+2 (not 3) → verify partial Juara
//   9. Set Juara 3 → verify "Juara Terpilih!" badge, sort = ju1, ju2, ju3 first
//  10. Selesaikan Lomba → verify "Selesai" badge + same Finalis display
//  11. Cleanup
const puppeteer = require('puppeteer-core');

const BASE = 'https://lomba-app.vercel.app';
const PASSWORD = 'lomba123';
const SUFFIX = 'kualsys-' + Date.now().toString(36);

let pass = 0;
let fail = 0;

function assert(condition, name) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ FAIL: ${name}`);
  }
}

async function api(method, path, body, session) {
  const headers = { 'Content-Type': 'application/json' };
  if (session) headers.Cookie = `lomba_kampung_session=${session}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function login() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/lomba_kampung_session=([^;]+)/);
  return match ? match[1] : null;
}

function badgeOf(status) {
  // Map phase→public label (matches PublicStatusBadge in app/lomba/[id]/page.tsx)
  if (status === 'selesai') return 'Selesai';
  if (status === 'final') return 'Tahap Final';
  if (status === 'kualifikasi') return 'Tahap Kualifikasi';
  if (status === 'juara-terpilih') return 'Juara Terpilih!';
  if (status === 'coming-soon') return 'Coming Soon';
  return 'Sedang Berlangsung';
}

(async () => {
  let browser;
  let session;
  let lombaId;
  const pendaftarIds = [];

  try {
    console.log('\n========== SETUP ==========');
    session = await login();
    assert(!!session, 'login as admin');
    if (!session) return;

    // 1. Create test lomba (k_anak, finalisCount=3)
    const createRes = await api('POST', '/api/admin/lomba', {
      nama: `Lomba E2E ${SUFFIX}`,
      emoji: '🎪',
      deskripsi: 'E2E test untuk full kualifikasi flow',
      syarat: ['Syarat test'],
      kategoriEligible: ['k_anak'],
      pjList: [{ kategoriId: 'k_anak', pjNama: 'PJ E2E', pjKontak: '081234567890' }],
      status: 'aktif',
      urutan: 999,
      finalisCount: 3,
    }, session);
    assert(createRes.status === 200, 'POST /api/admin/lomba (create test lomba)');
    assert(createRes.body.id > 0, `  lomba id > 0 (got ${createRes.body.id})`);
    lombaId = createRes.body.id;
    if (!lombaId) return;

    // 2. Create 5 pendaftar (so 2 are non-finalists in kualifikasi)
    const names = [
      { nama: `Ahmad ${SUFFIX}`, umur: 7, jk: 'L' },
      { nama: `Budi ${SUFFIX}`, umur: 10, jk: 'L' },
      { nama: `Citra ${SUFFIX}`, umur: 8, jk: 'P' },
      { nama: `Dewi ${SUFFIX}`, umur: 12, jk: 'P' },
      { nama: `Eka ${SUFFIX}`, umur: 9, jk: 'L' },
    ];
    for (const n of names) {
      const r = await api('POST', '/api/admin/pendaftar', {
        nama: n.nama, jenisKelamin: n.jk, kategoriId: 'k_anak', umur: n.umur, lombaId,
      }, session);
      assert(r.status === 200, `  create pendaftar ${n.nama}`);
      if (r.status === 200) pendaftarIds.push({ id: r.body.id, ...n });
    }
    assert(pendaftarIds.length === 5, `5 pendaftar created`);

    // ---- Launch browser for public lens checks ----
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });

    // Helper to read public page state
    async function readPublic() {
      await page.goto(`${BASE}/lomba/${lombaId}`, { waitUntil: 'networkidle0', timeout: 30000 });
      return await page.evaluate(() => {
        const badge = document.querySelector('.public-status-badge');
        const badgeText = badge ? badge.textContent.trim() : null;
        // Find Finalis section header (h3 containing "Finalis" — FA icon uses CSS, not text)
        // Regex: match h3 with "Finalis" as the first significant text (h3 may have nested <span> for count)
        const allH3 = Array.from(document.querySelectorAll('h3'));
        const finalisHeader = allH3.find((h) => {
          const t = (h.textContent || '').trim();
          return t.startsWith('Finalis');
        });
        // Get finalis row names in order
        const finalisRows = finalisHeader
          ? Array.from(finalisHeader.parentElement.querySelectorAll('.juara-public-nama')).map((n) => n.textContent.trim())
          : [];
        // Get Juara labels
        const finalisLabels = finalisHeader
          ? Array.from(finalisHeader.parentElement.querySelectorAll('.juara-public-label')).map((l) => l.textContent.trim())
          : [];
        // Check if Peserta Terdaftar section shows full list (5 pendaftar) OR just finalists
        const pesertaHeader = allH3.find((h) => /Peserta Terdaftar/i.test(h.textContent || ''));
        const pesertaCount = pesertaHeader
          ? pesertaHeader.parentElement.querySelectorAll('table tbody tr').length
          : 0;
        return { badgeText, hasFinalisSection: !!finalisHeader, finalisRows, finalisLabels, pesertaCount };
      });
    }

    console.log('\n========== TEST 1: Public BEFORE kualifikasi ==========');
    // Phase 3.1: status=aktif, phase=NULL, no Juara, 5 pendaftar
    const t1 = await readPublic();
    assert(t1.badgeText === 'Sedang Berlangsung', `badge = "Sedang Berlangsung" (got "${t1.badgeText}")`);
    assert(!t1.hasFinalisSection, 'no Finalis section (phase belum final)');
    assert(t1.pesertaCount === 5, `5 peserta di Peserta Terdaftar (got ${t1.pesertaCount})`);

    console.log('\n========== TEST 2: Public during KUALIFIKASI ==========');
    // 4. Mulai Kualifikasi
    const mulaiRes = await api('POST', `/api/admin/lomba/${lombaId}/mulai-kualifikasi`, null, session);
    assert(mulaiRes.status === 200, 'POST mulai-kualifikasi');
    assert(mulaiRes.body.phase === 'kualifikasi', `  phase=kualifikasi (got ${mulaiRes.body.phase})`);

    // 4.1 Verify public badge
    const t2 = await readPublic();
    assert(t2.badgeText === 'Tahap Kualifikasi', `badge = "Tahap Kualifikasi" (got "${t2.badgeText}")`);
    assert(!t2.hasFinalisSection, 'no Finalis section during kualifikasi (per spec)');
    assert(t2.pesertaCount === 5, 'peserta section still shows 5 (full peserta list)');

    // 5. Set 3 finalists (rank 1, 2, 3) via API
    // Pick: Citra (8, P), Eka (9, L), Dewi (12, P) → all eligible
    const finalisPick = [pendaftarIds[2], pendaftarIds[4], pendaftarIds[3]]; // Citra, Eka, Dewi
    for (let i = 0; i < finalisPick.length; i++) {
      const r = await api('POST', `/api/admin/lomba/${lombaId}/juara`, {
        pendaftarId: finalisPick[i].id, rank: i + 1,
      }, session);
      assert(r.status === 200, `set finalist ${finalisPick[i].nama} → rank ${i + 1}`);
    }
    // 6. Verify public still no Finalis section (kualifikasi belum tutup)
    const t2b = await readPublic();
    assert(t2b.badgeText === 'Tahap Kualifikasi', `badge still "Tahap Kualifikasi" (got "${t2b.badgeText}")`);
    assert(!t2b.hasFinalisSection, 'no Finalis section yet (kualifikasi belum tutup)');

    console.log('\n========== TEST 3: Public after TUTUP KUALIFIKASI (phase=final) ==========');
    // 7. Tutup Kualifikasi → phase=final
    // NB: with finalisCount=3 and finalists picked at rank 1,2,3 — these 3
    // finalists auto-become Juara 1, 2, 3 in final phase (per v3 design —
    // juara_rank is reused for both kualifikasi slot and Juara rank).
    // So badge jumps directly to "Juara Terpilih!" (skips "Tahap Final").
    const tutupRes = await api('POST', `/api/admin/lomba/${lombaId}/tutup-kualifikasi`, null, session);
    assert(tutupRes.status === 200, 'POST tutup-kualifikasi');
    assert(tutupRes.body.phase === 'final', `  phase=final (got ${tutupRes.body.phase})`);

    // 7.1 Verify public badge = "Juara Terpilih!" (auto- Juara from kualifikasi slots)
    const t3 = await readPublic();
    assert(t3.badgeText === 'Juara Terpilih!', `badge = "Juara Terpilih!" (auto from kualifikasi slots) (got "${t3.badgeText}")`);
    assert(t3.hasFinalisSection, 'Finalis section VISIBLE (phase=final)');
    assert(t3.finalisRows.length === 3, `3 finalists shown (got ${t3.finalisRows.length}: ${t3.finalisRows.join(', ')})`);
    // Sort: ju1, ju2, ju3 in order
    assert(t3.finalisRows[0] === finalisPick[0].nama, `  sort #1 = ju1 (${finalisPick[0].nama}, got ${t3.finalisRows[0]})`);
    assert(t3.finalisRows[1] === finalisPick[1].nama, `  sort #2 = ju2 (${finalisPick[1].nama}, got ${t3.finalisRows[1]})`);
    assert(t3.finalisRows[2] === finalisPick[2].nama, `  sort #3 = ju3 (${finalisPick[2].nama}, got ${t3.finalisRows[2]})`);
    // Labels: Juara 1, Juara 2, Juara 3
    assert(t3.finalisLabels[0] === 'Juara 1', `  label #1 = "Juara 1" (got "${t3.finalisLabels[0]}")`);
    assert(t3.finalisLabels[1] === 'Juara 2', `  label #2 = "Juara 2" (got "${t3.finalisLabels[1]}")`);
    assert(t3.finalisLabels[2] === 'Juara 3', `  label #3 = "Juara 3" (got "${t3.finalisLabels[2]}")`);

    console.log('\n========== TEST 4: Public Tahap Final (with finalisCount=5 + skip-rank trick) ==========');
    // To actually see "Tahap Final" badge (partial Juara state), we need:
    //   finalisCount=5, pick 5 finalists, but with ranks 2,3,4,5,6 (skip rank 1)
    // → after Tutup: ju1=0, ju2=1, ju3=1 → not allReady → "Tahap Final"
    // This validates the "Tahap Final" badge is reachable in practice.
    const createRes2 = await api('POST', '/api/admin/lomba', {
      nama: `Lomba E2E #2 ${SUFFIX}`,
      emoji: '🎨',
      deskripsi: 'E2E test for Tahap Final state',
      syarat: ['Test'],
      kategoriEligible: ['k_anak'],
      pjList: [{ kategoriId: 'k_anak', pjNama: 'PJ E2E', pjKontak: '081234567890' }],
      status: 'aktif', urutan: 998, finalisCount: 5,
    }, session);
    const lombaId2 = createRes2.body.id;
    assert(lombaId2 > 0, `create second test lomba (id=${lombaId2})`);

    // Create 5 pendaftar
    const p2 = [];
    for (const n of [
      { nama: `P1 ${SUFFIX}`, umur: 6, jk: 'L' },
      { nama: `P2 ${SUFFIX}`, umur: 7, jk: 'P' },
      { nama: `P3 ${SUFFIX}`, umur: 8, jk: 'L' },
      { nama: `P4 ${SUFFIX}`, umur: 9, jk: 'P' },
      { nama: `P5 ${SUFFIX}`, umur: 10, jk: 'L' },
    ]) {
      const r = await api('POST', '/api/admin/pendaftar', {
        nama: n.nama, jenisKelamin: n.jk, kategoriId: 'k_anak', umur: n.umur, lombaId: lombaId2,
      }, session);
      if (r.status === 200) p2.push({ id: r.body.id, ...n });
    }
    assert(p2.length === 5, '5 pendaftar for second lomba');

    // Mulai Kualifikasi + pick 5 finalists with ranks 2,3,4,5,6 (skip 1)
    await api('POST', `/api/admin/lomba/${lombaId2}/mulai-kualifikasi`, null, session);
    for (let i = 0; i < 5; i++) {
      await api('POST', `/api/admin/lomba/${lombaId2}/juara`, {
        pendaftarId: p2[i].id, rank: i + 2, // ranks 2,3,4,5,6
      }, session);
    }
    await api('POST', `/api/admin/lomba/${lombaId2}/tutup-kualifikasi`, null, session);

    // Verify "Tahap Final" badge (no ju1 yet, but ju2+ exist)
    await page.goto(`${BASE}/lomba/${lombaId2}`, { waitUntil: 'networkidle0', timeout: 30000 });
    const t4 = await page.evaluate(() => {
      const badge = document.querySelector('.public-status-badge');
      return { badgeText: badge ? badge.textContent.trim() : null };
    });
    assert(t4.badgeText === 'Tahap Final', `lomba #2: badge = "Tahap Final" (ju1 missing, got "${t4.badgeText}")`);

    // Cleanup lomba #2
    const delRes2 = await api('DELETE', `/api/admin/lomba/${lombaId2}`, null, session);
    assert(delRes2.status === 200, 'DELETE second test lomba');

    console.log('\n========== TEST 5: Public after Selesaikan ==========');
    // 10. Selesaikan Lomba (lomba #1)
    const selesaiRes = await api('POST', `/api/admin/lomba/${lombaId}/selesai`, null, session);
    assert(selesaiRes.status === 200, 'POST selesai');

    // 10.1 Verify badge = "Selesai", same Finalis display
    const t5 = await readPublic();
    assert(t5.badgeText === 'Selesai', `badge = "Selesai" (got "${t5.badgeText}")`);
    assert(t5.finalisRows.length === 3, `Finalis still shows 3 (got ${t5.finalisRows.length})`);
    assert(t5.finalisLabels.join(',') === 'Juara 1,Juara 2,Juara 3', `Juara labels preserved after selesai (got [${t5.finalisLabels.join(', ')}])`);

    // Peserta Terdaftar section should still show ALL 5 (not just finalists)
    assert(t5.pesertaCount === 5, `Peserta Terdaftar still shows 5 (got ${t5.pesertaCount})`);

    // Verify finalis section comes BEFORE Peserta Terdaftar in DOM order
    const orderCheck = await page.evaluate(() => {
      const h3s = Array.from(document.querySelectorAll('h3'));
      const finalisIdx = h3s.findIndex((h) => /Finalis/i.test(h.textContent || ''));
      const pesertaIdx = h3s.findIndex((h) => /Peserta Terdaftar/i.test(h.textContent || ''));
      return { finalisIdx, pesertaIdx, ok: finalisIdx >= 0 && finalisIdx < pesertaIdx };
    });
    assert(orderCheck.ok, `Finalis section BEFORE Peserta Terdaftar (finalis=${orderCheck.finalisIdx}, peserta=${orderCheck.pesertaIdx})`);

    // 11. Cleanup lomba #1
    console.log('\n========== CLEANUP ==========');
    const delRes = await api('DELETE', `/api/admin/lomba/${lombaId}`, null, session);
    assert(delRes.status === 200, 'DELETE test lomba');

    // ========== Summary ==========
    console.log(`\n========== SUMMARY ==========`);
    console.log(`PASS: ${pass}`);
    console.log(`FAIL: ${fail}`);
    console.log(`Total: ${pass + fail}`);
    process.exit(fail === 0 ? 0 : 1);
  } catch (err) {
    console.log('\nERROR:', err.message);
    console.log(err.stack);
    // Attempt cleanup
    if (session && lombaId) {
      console.log('\nAttempting cleanup...');
      await api('DELETE', `/api/admin/lomba/${lombaId}`, null, session);
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
