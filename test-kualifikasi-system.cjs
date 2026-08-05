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
        // Find Finalis section header (h3 containing "Finalis" text)
        const allH3 = Array.from(document.querySelectorAll('h3'));
        const finalisHeader = allH3.find((h) => /^\s*🏆\s*Finalis/i.test(h.textContent || ''));
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
    // 6. Verify public still no Finalis section
    const t2b = await readPublic();
    assert(t2b.badgeText === 'Tahap Kualifikasi', `badge still "Tahap Kualifikasi" (got "${t2b.badgeText}")`);
    assert(!t2b.hasFinalisSection, 'no Finalis section yet (kualifikasi belum tutup)');

    console.log('\n========== TEST 3: Public during FINAL (Juara picking) ==========');
    // 7. Tutup Kualifikasi
    const tutupRes = await api('POST', `/api/admin/lomba/${lombaId}/tutup-kualifikasi`, null, session);
    assert(tutupRes.status === 200, 'POST tutup-kualifikasi');
    assert(tutupRes.body.phase === 'final', `  phase=final (got ${tutupRes.body.phase})`);

    // 7.1 Verify public badge
    const t3 = await readPublic();
    assert(t3.badgeText === 'Tahap Final', `badge = "Tahap Final" (got "${t3.badgeText}")`);
    assert(t3.hasFinalisSection, 'Finalis section VISIBLE (phase=final)');
    assert(t3.finalisRows.length === 3, `3 finalists shown (got ${t3.finalisRows.length}: ${t3.finalisRows.join(', ')})`);
    // Sort: rank 1, 2, 3 (in order)
    assert(t3.finalisRows[0] === finalisPick[0].nama, `  first finalist = ${finalisPick[0].nama} (got ${t3.finalisRows[0]})`);
    assert(t3.finalisRows[1] === finalisPick[1].nama, `  second finalist = ${finalisPick[1].nama} (got ${t3.finalisRows[1]})`);
    assert(t3.finalisRows[2] === finalisPick[2].nama, `  third finalist = ${finalisPick[2].nama} (got ${t3.finalisRows[2]})`);
    // No Juara labels yet
    assert(t3.finalisLabels.every((l) => l === 'Finalis'), `all labels = "Finalis" (got [${t3.finalisLabels.join(', ')}])`);

    console.log('\n========== TEST 4: Public during FINAL (Juara partial) ==========');
    // 8. Set Juara 1 + Juara 2 (not Juara 3)
    const j1 = await api('POST', `/api/admin/lomba/${lombaId}/juara`, { pendaftarId: finalisPick[0].id, rank: 1 }, session);
    const j2 = await api('POST', `/api/admin/lomba/${lombaId}/juara`, { pendaftarId: finalisPick[1].id, rank: 2 }, session);
    assert(j1.status === 200, 'set Juara 1');
    assert(j2.status === 200, 'set Juara 2');

    // 8.1 Verify badge still "Tahap Final" (not allReady yet)
    const t4 = await readPublic();
    assert(t4.badgeText === 'Tahap Final', `badge still "Tahap Final" (got "${t4.badgeText}")`);
    assert(t4.finalisRows.length === 3, '3 finalists still shown');
    // Sort: ju1, ju2, then non-Juara (the 3rd finalist) by umur ASC
    // finalisPick[2] = Dewi (12) — no Juara label, but only 3 finalists, so she's last
    assert(t4.finalisRows[0] === finalisPick[0].nama, `  first = ju1 (${finalisPick[0].nama})`);
    assert(t4.finalisRows[1] === finalisPick[1].nama, `  second = ju2 (${finalisPick[1].nama})`);
    assert(t4.finalisRows[2] === finalisPick[2].nama, `  third = non-Juara (${finalisPick[2].nama})`);
    // Labels: ju1, ju2, "Finalis"
    assert(t4.finalisLabels[0] === 'Juara 1', `  first label = "Juara 1" (got "${t4.finalisLabels[0]}")`);
    assert(t4.finalisLabels[1] === 'Juara 2', `  second label = "Juara 2" (got "${t4.finalisLabels[1]}")`);
    assert(t4.finalisLabels[2] === 'Finalis', `  third label = "Finalis" (got "${t4.finalisLabels[2]}")`);

    console.log('\n========== TEST 5: Public after all Juara picked (selesai=juara-terpilih) ==========');
    // 9. Set Juara 3
    const j3 = await api('POST', `/api/admin/lomba/${lombaId}/juara`, { pendaftarId: finalisPick[2].id, rank: 3 }, session);
    assert(j3.status === 200, 'set Juara 3');

    // 9.1 Verify badge = "Juara Terpilih!"
    const t5 = await readPublic();
    assert(t5.badgeText === 'Juara Terpilih!', `badge = "Juara Terpilih!" (got "${t5.badgeText}")`);
    // Sort: ju1, ju2, ju3
    assert(t5.finalisRows[0] === finalisPick[0].nama, `  sort #1 = ju1 (${finalisPick[0].nama})`);
    assert(t5.finalisRows[1] === finalisPick[1].nama, `  sort #2 = ju2 (${finalisPick[1].nama})`);
    assert(t5.finalisRows[2] === finalisPick[2].nama, `  sort #3 = ju3 (${finalisPick[2].nama})`);
    assert(t5.finalisLabels[0] === 'Juara 1' && t5.finalisLabels[1] === 'Juara 2' && t5.finalisLabels[2] === 'Juara 3', 'all 3 Juara labels correct');

    console.log('\n========== TEST 6: Public after Selesaikan ==========');
    // 10. Selesaikan Lomba
    const selesaiRes = await api('POST', `/api/admin/lomba/${lombaId}/selesai`, null, session);
    assert(selesaiRes.status === 200, 'POST selesai');

    // 10.1 Verify badge = "Selesai", same Finalis display
    const t6 = await readPublic();
    assert(t6.badgeText === 'Selesai', `badge = "Selesai" (got "${t6.badgeText}")`);
    assert(t6.finalisRows.length === 3, 'Finalis still shows 3');
    assert(t6.finalisLabels.join(',') === 'Juara 1,Juara 2,Juara 3', 'Juara labels preserved after selesai');

    // Peserta Terdaftar section should still show ALL 5 (not just finalists)
    assert(t6.pesertaCount === 5, `Peserta Terdaftar still shows 5 (got ${t6.pesertaCount})`);

    // Verify finalis section comes BEFORE Peserta Terdaftar in DOM order
    const orderCheck = await page.evaluate(() => {
      const h3s = Array.from(document.querySelectorAll('h3'));
      const finalisIdx = h3s.findIndex((h) => /Finalis/i.test(h.textContent || ''));
      const pesertaIdx = h3s.findIndex((h) => /Peserta Terdaftar/i.test(h.textContent || ''));
      return { finalisIdx, pesertaIdx, ok: finalisIdx >= 0 && finalisIdx < pesertaIdx };
    });
    assert(orderCheck.ok, `Finalis section BEFORE Peserta Terdaftar (finalis=${orderCheck.finalisIdx}, peserta=${orderCheck.pesertaIdx})`);

    // 11. Cleanup
    console.log('\n========== CLEANUP ==========');
    const delRes = await api('DELETE', `/api/admin/lomba/${lombaId}`, null, session);
    assert(delRes.status === 200, 'DELETE test lomba');

    // 12. After cleanup, public page should 404
    const pageResp = await fetch(`${BASE}/lomba/${lombaId}`);
    assert(pageResp.status === 404, `public page 404 after delete (got ${pageResp.status})`);

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
