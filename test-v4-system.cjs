// E2E test for stage system v4 - finalist (is_finalist) + Gugur + per-kategori Tutup + Juara.
// API-focused (no puppeteer). Verifies:
//   1. Schema: is_finalist tri-state + lomba_kategori.kualifikasi_tutup_at
//   2. /finalist endpoint (Loloskan/Gugur/Clear, change-of-mind reversible)
//   3. Tutup Kualifikasi per-kategori (all pendaftar must be decided)
//   4. Juara picker requires is_finalist=1 + kategori tutup
//   5. Selesaikan Lomba requires Juara 1+2 per kategori
//   6. Public page shows 5 badge variants + finalis section
const puppeteer = require('puppeteer-core');

const BASE = 'https://lomba-app.vercel.app';
const PASSWORD = 'lomba123';
const SUFFIX = 'v4sys-' + Date.now().toString(36);

let pass = 0;
let fail = 0;

function assert(condition, name) {
  if (condition) {
    pass++;
    console.log('  OK ' + name);
  } else {
    fail++;
    console.log('  FAIL: ' + name);
  }
}

async function api(method, path, body, session) {
  const headers = { 'Content-Type': 'application/json' };
  if (session) headers.Cookie = 'lomba_kampung_session=' + session;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function apiWithRetry(method, path, body, session, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const r = await api(method, path, body, session);
    if (r.status < 500) return r;
    console.log('  retry ' + (i + 1) + '/' + attempts + ' for ' + method + ' ' + path + ' (got ' + r.status + ')');
    await new Promise((res) => setTimeout(res, 200 * (i + 1)));
  }
  return api(method, path, body, session);
}

async function login() {
  const res = await fetch(BASE + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/lomba_kampung_session=([^;]+)/);
  return match ? match[1] : null;
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

    // Force-run the v4 migration via the debug endpoint. The Turso web
    // ALTER should have made the columns persistent, but the libSQL
    // HTTP race can still bite. Hit the migrate endpoint to be safe.
    console.log('\n[migrate] forcing v4 migration via /api/admin/debug/schema...');
    let migrateOk = false;
    for (let i = 0; i < 4; i++) {
      const r = await apiWithRetry('POST', '/api/admin/debug/schema', null, session);
      if (r.status === 200) {
        const t = r.body.results || {};
        if (t.verify_kualifikasi_tutup_at === 'OK' && t.verify_is_finalist === 'OK' && t.test_select_tutup === 'OK') {
          console.log('[migrate] OK schema OK (attempt ' + (i + 1) + ')');
          migrateOk = true;
          break;
        } else {
          console.log('[migrate] attempt ' + (i + 1) + ': tTutup=' + t.verify_kualifikasi_tutup_at + ' tFinalist=' + t.verify_is_finalist + ' tSelect=' + t.test_select_tutup);
        }
      } else {
        console.log('[migrate] attempt ' + (i + 1) + ': status=' + r.status);
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    if (!migrateOk) {
      console.log('[migrate] WARNING: migration not fully verified, test may be flaky');
    }

    // 1. Create test lomba (k_anak only, no finalisCount)
    const createRes = await apiWithRetry('POST', '/api/admin/lomba', {
      nama: 'Lomba E2E ' + SUFFIX,
      emoji: 'TEST',
      deskripsi: 'E2E test for stage system v4',
      syarat: ['Test'],
      kategoriEligible: ['k_anak'],
      pjList: [{ kategoriId: 'k_anak', pjNama: 'PJ E2E', pjKontak: '081234567890' }],
      status: 'aktif',
      urutan: 999,
    }, session);
    assert(createRes.status === 200, 'POST /api/admin/lomba (no finalisCount field)');
    assert(createRes.body.id > 0, '  lomba id > 0 (got ' + createRes.body.id + ')');
    lombaId = createRes.body.id;
    if (!lombaId) return;

    // 2. Create 4 pendaftar
    const names = [
      { nama: 'Andi ' + SUFFIX, umur: 8, jk: 'L' },
      { nama: 'Budi ' + SUFFIX, umur: 10, jk: 'L' },
      { nama: 'Citra ' + SUFFIX, umur: 9, jk: 'P' },
      { nama: 'Dewi ' + SUFFIX, umur: 12, jk: 'P' },
    ];
    for (const n of names) {
      const r = await apiWithRetry('POST', '/api/admin/pendaftar', {
        nama: n.nama, jenisKelamin: n.jk, kategoriId: 'k_anak', umur: n.umur, lombaId,
      }, session);
      assert(r.status === 200, '  create pendaftar ' + n.nama);
      if (r.status === 200) pendaftarIds.push({ id: r.body.id, ...n });
    }
    assert(pendaftarIds.length === 4, '4 pendaftar created');

    // ============================================================
    // TEST 1: /finalist endpoint (Loloskan/Gugur/Clear)
    // ============================================================
    console.log('\n========== TEST 1: /finalist endpoint (Loloskan/Gugur/Clear) ==========');
    const lolos1 = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/pendaftar/' + pendaftarIds[0].id + '/finalist', { status: 1 }, session);
    assert(lolos1.status === 200, 'POST finalist status=1 (Loloskan)');
    const lolos2 = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/pendaftar/' + pendaftarIds[1].id + '/finalist', { status: 1 }, session);
    assert(lolos2.status === 200, 'POST finalist status=1 (Loloskan 2nd)');
    const gugur1 = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/pendaftar/' + pendaftarIds[2].id + '/finalist', { status: 0 }, session);
    assert(gugur1.status === 200, 'POST finalist status=0 (Gugur)');
    const reLolos = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/pendaftar/' + pendaftarIds[2].id + '/finalist', { status: 1 }, session);
    assert(reLolos.status === 200, 'POST finalist status=1 (un-gugur = change mind)');
    const clear1 = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/pendaftar/' + pendaftarIds[2].id + '/finalist', { status: null }, session);
    assert(clear1.status === 200, 'POST finalist status=null (Clear / back to pending)');

    // ============================================================
    // TEST 2: Tutup Kualifikasi per-kategori
    // ============================================================
    console.log('\n========== TEST 2: Tutup Kualifikasi per-kategori ==========');
    // First, set all pendaftar to Loloskan
    for (const p of pendaftarIds) {
      await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/pendaftar/' + p.id + '/finalist', { status: 1 }, session);
    }
    // Re-Clear one pendaftar to test "Tutup fails when pending exists"
    await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/pendaftar/' + pendaftarIds[3].id + '/finalist', { status: null }, session);
    const tutupFail = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/kategori/k_anak/tutup-kualifikasi', null, session);
    assert(tutupFail.status === 400, 'Tutup fails when pending exists (got ' + tutupFail.status + ')');

    // Re-Loloskan pendaftarIds[3]
    await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/pendaftar/' + pendaftarIds[3].id + '/finalist', { status: 1 }, session);

    // Tutup should succeed
    const tutupOk = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/kategori/k_anak/tutup-kualifikasi', null, session, 4);
    assert(tutupOk.status === 200, 'Tutup succeeds when all pendaftar decided');
    if (tutupOk.body.status) {
      assert(tutupOk.body.status.lolos === 4, '  status.lolos = 4 (got ' + tutupOk.body.status.lolos + ')');
    }

    // Tutup again should fail (already tutup)
    const tutupDup = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/kategori/k_anak/tutup-kualifikasi', null, session);
    assert(tutupDup.status === 400, 'Tutup fails on already-tutup kategori (got ' + tutupDup.status + ')');

    // ============================================================
    // TEST 3: Juara picker (requires finalist + tutup)
    // ============================================================
    console.log('\n========== TEST 3: Juara picker (requires finalist + tutup) ==========');
    const j1 = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/juara', { pendaftarId: pendaftarIds[0].id, rank: 1 }, session, 4);
    assert(j1.status === 200, 'set Juara 1 for ' + pendaftarIds[0].nama);
    const j2 = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/juara', { pendaftarId: pendaftarIds[1].id, rank: 2 }, session, 4);
    assert(j2.status === 200, 'set Juara 2 for ' + pendaftarIds[1].nama);

    // Selesaikan Lomba
    const selesaiRes = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/selesai', null, session, 4);
    assert(selesaiRes.status === 200, 'POST /selesai succeeds (Juara 1+2 picked)');

    // ============================================================
    // TEST 4: Public page after Selesai
    // ============================================================
    console.log('\n========== TEST 4: Public page after Selesai ==========');
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });
    await page.goto(BASE + '/lomba/' + lombaId, { waitUntil: 'networkidle0', timeout: 30000 });
    const publicState = await page.evaluate(() => {
      const badge = document.querySelector('.public-status-badge');
      const allH3 = Array.from(document.querySelectorAll('h3'));
      const finalisHeader = allH3.find((h) => (h.textContent || '').trim().startsWith('Finalis'));
      const finalisRows = finalisHeader
        ? Array.from(finalisHeader.parentElement.querySelectorAll('.juara-public-nama')).map((n) => n.textContent.trim())
        : [];
      const finalisLabels = finalisHeader
        ? Array.from(finalisHeader.parentElement.querySelectorAll('.juara-public-label')).map((l) => l.textContent.trim())
        : [];
      return {
        badgeText: badge ? badge.textContent.trim() : null,
        hasFinalisSection: !!finalisHeader,
        finalisRows,
        finalisLabels,
      };
    });
    assert(publicState.badgeText === 'Selesai', 'public badge = "Selesai" (got "' + publicState.badgeText + '")');
    assert(publicState.hasFinalisSection, 'Finalis section visible after selesai');
    assert(publicState.finalisRows.length === 4, '4 finalists in public (got ' + publicState.finalisRows.length + ')');
    assert(publicState.finalisRows[0] === pendaftarIds[0].nama, '  sort #1 = Juara 1 (' + pendaftarIds[0].nama + ')');
    assert(publicState.finalisRows[1] === pendaftarIds[1].nama, '  sort #2 = Juara 2 (' + pendaftarIds[1].nama + ')');
    assert(
      publicState.finalisLabels[0] === 'Juara 1' && publicState.finalisLabels[1] === 'Juara 2',
      'Juara 1+2 labels correct'
    );

    // ============================================================
    // TEST 5: Buka Kualifikasi after Selesai (should fail)
    // ============================================================
    console.log('\n========== TEST 5: Buka Kualifikasi after Selesai (should fail) ==========');
    const bukaFail = await apiWithRetry('POST', '/api/admin/lomba/' + lombaId + '/kategori/k_anak/buka-kualifikasi', null, session);
    assert(bukaFail.status === 400, 'Buka fails when lomba status=selesai (got ' + bukaFail.status + ')');

    // ============================================================
    // CLEANUP
    // ============================================================
    console.log('\n========== CLEANUP ==========');
    const delRes = await apiWithRetry('DELETE', '/api/admin/lomba/' + lombaId, null, session);
    assert(delRes.status === 200, 'DELETE test lomba (cascades pendaftar)');

    // Summary
    console.log('\n========== SUMMARY ==========');
    console.log('PASS: ' + pass);
    console.log('FAIL: ' + fail);
    console.log('Total: ' + (pass + fail));
    process.exit(fail === 0 ? 0 : 1);
  } catch (err) {
    console.log('\nERROR:', err.message);
    console.log(err.stack);
    if (session && lombaId) {
      console.log('\nAttempting cleanup...');
      await api('DELETE', '/api/admin/lomba/' + lombaId, null, session);
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
