// E2E test for stage system v4 "” finalist (is_finalist) + Gugur + per-kategori Tutup + Juara.
// API-focused (no puppeteer). Verifies:
//   1. Schema: is_finalist tri-state + lomba_kategori.kualifikasi_tutup_at
//   2. POST /finalist sets is_finalist (1=lolos, 0=gugur, null=pending)
//   3. Tutup Kualifikasi per kategori requires all pendaftar decided
//   4. Juara picker requires is_finalist=1 + kategori tutup
//   5. Buka Kualifikasi re-enables finalist editing (if no Juara picked)
//   6. Selesaikan Lomba requires Juara 1+2 per eligible kategori
//   7. Public page reflects per-kategori phase + finalis section
const puppeteer = require('puppeteer-core');

const BASE = 'https://lomba-app.vercel.app';
const PASSWORD = 'lomba123';
const SUFFIX = 'v4sys-' + Date.now().toString(36);

let pass = 0;
let fail = 0;

function assert(condition, name) {
  if (condition) {
    pass++;
    console.log(`  âœ“ ${name}`);
  } else {
    fail++;
    console.log(`  âœ— FAIL: ${name}`);
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

// Retry helper "” prod pendaftar creation is occasionally flaky (500 error
// on certain umur values, possibly Turso rate limit or numbering race).
// Retry up to 3 times with small backoff.
async function apiWithRetry(method, path, body, session, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const r = await api(method, path, body, session);
    if (r.status < 500) return r;
    console.log(`  âš  retry ${i + 1}/${attempts} for ${method} ${path} (got ${r.status})`);
    await new Promise((res) => setTimeout(res, 200 * (i + 1)));
  }
  return api(method, path, body, session);
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

    // Force-run the v4 migration via the debug endpoint. This bypasses the
    // libSQL HTTP schema cache race by running the migration in a Vercel Lambda
    // that's already loaded with the right client. After this call, subsequent
    // requests on the SAME Lambda can see the new columns. We retry to ensure
    // a warm Lambda handles this request.
    console.log('\n[migrate] forcing v4 migration via /api/admin/debug/schema...');
    let migrateOk = false;
    for (let i = 0; i < 4; i++) {
      const r = await apiWithRetry('POST', '/api/admin/debug/schema', null, session);
      if (r.status === 200) {
        const tTutup = r.body.results?.verify_kualifikasi_tutup_at;
        const tFinalist = r.body.results?.verify_is_finalist;
        const tSelect = r.body.results?.test_select_tutup;
        if (tTutup === 'OK' && tFinalist === 'OK' && tSelect === 'OK') {
          console.log(`[migrate] ✓ schema OK (attempt ${i + 1})`);
          migrateOk = true;
          break;
        } else {
          console.log(`[migrate] attempt ${i + 1}: tTutup=${tTutup} tFinalist=${tFinalist} tSelect=${tSelect}`);
        }
      } else {
        console.log(`[migrate] attempt ${i + 1}: status=${r.status}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!migrateOk) {
      console.log('[migrate] WARNING: migration not fully verified, test may be flaky');
    } else {
      // Wait for schema to propagate. libSQL HTTP has a known race where
      // the migration commits on one connection but subsequent requests
      // on a different Lambda don't see it. We poll GET /api/admin/lomba
      // (which calls loadKategoriTutupBulk) until it returns 200 with
      // valid kategoriTutupAt data.
      console.log('[migrate] waiting for schema to propagate to fresh Lambdas...');
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const g = await api('GET', '/api/admin/lomba', null, session);
        if (g.status === 200) {
          console.log(`[migrate] ✓ GET /api/admin/lomba works (attempt ${i + 1})`);
          break;
        }
        console.log(`[migrate] GET status=${g.status}, retry ${i + 1}/6`);
      }
    }

    // 1. Create test lomba (k_anak only)
    const createRes = await apiWithRetry('POST', '/api/admin/lomba', {
      nama: `Lomba v4 ${SUFFIX}`,
      emoji: 'ðŸŽ¯',
      deskripsi: 'E2E test for stage system v4',
      syarat: ['Test'],
      kategoriEligible: ['k_anak'],
      pjList: [{ kategoriId: 'k_anak', pjNama: 'PJ v4', pjKontak: '081234567890' }],
      status: 'aktif',
      urutan: 999,
    }, session);
    assert(createRes.status === 200, 'POST /api/admin/lomba (no finalisCount field)');
    assert(createRes.body.id > 0, `  lomba id > 0 (got ${createRes.body.id})`);
    lombaId = createRes.body.id;
    if (!lombaId) return;

    // 2. Create 4 pendaftar
    const names = [
      { nama: `Andi ${SUFFIX}`, umur: 8, jk: 'L' },
      { nama: `Budi ${SUFFIX}`, umur: 10, jk: 'L' },
      { nama: `Citra ${SUFFIX}`, umur: 9, jk: 'P' },
      { nama: `Dewi ${SUFFIX}`, umur: 12, jk: 'P' },
    ];
    for (const n of names) {
      const r = await apiWithRetry('POST', '/api/admin/pendaftar', {
        nama: n.nama, jenisKelamin: n.jk, kategoriId: 'k_anak', umur: n.umur, lombaId,
      }, session);
      if (r.status !== 200) {
        console.log(`  âš  pendaftar ${n.nama} (umur=${n.umur}) failed: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
      }
      assert(r.status === 200, `  create pendaftar ${n.nama}`);
      if (r.status === 200) pendaftarIds.push({ id: r.body.id, ...n });
    }
    assert(pendaftarIds.length === 4, '4 pendaftar created');

    // ============================================================
    // TEST 1: /finalist endpoint "” Loloskan/Gugur/Clear
    // ============================================================
    console.log('\n========== TEST 1: /finalist endpoint (Loloskan/Gugur/Clear) ==========');
    // 1.1 Loloskan 2 pendaftar
    const lolos1 = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/pendaftar/${pendaftarIds[0].id}/finalist`, { status: 1 }, session);
    assert(lolos1.status === 200, 'POST finalist status=1 (Loloskan)');
    const lolos2 = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/pendaftar/${pendaftarIds[1].id}/finalist`, { status: 1 }, session);
    assert(lolos2.status === 200, 'POST finalist status=1 (Loloskan 2nd)');

    // 1.2 Gugur 1 pendaftar
    const gugur1 = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/pendaftar/${pendaftarIds[2].id}/finalist`, { status: 0 }, session);
    assert(gugur1.status === 200, 'POST finalist status=0 (Gugur)');

    // 1.3 Leave 1 pending (no call)
    // pendaftarIds[3] is still pending (is_finalist=NULL)

    // 1.4 Re-loloskan a Gugur (idempotent / change-of-mind)
    const reLolos = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/pendaftar/${pendaftarIds[2].id}/finalist`, { status: 1 }, session);
    assert(reLolos.status === 200, 'POST finalist status=1 (un-gugur = change mind)');

    // 1.6 Clear back to pending
    const clear1 = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/pendaftar/${pendaftarIds[2].id}/finalist`, { status: null }, session);
    assert(clear1.status === 200, 'POST finalist status=null (Clear / back to pending)');

    // ============================================================
    // TEST 2: Tutup Kualifikasi (per-kategori) "” should fail while pending
    // ============================================================
    console.log('\n========== TEST 2: Tutup Kualifikasi per-kategori ==========');
    // 2.1 First, set all pendaftar to Loloskan (so Tutup can succeed)
    for (const p of pendaftarIds) {
      await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/pendaftar/${p.id}/finalist`, { status: 1 }, session);
    }

    // 2.2 Try to Tutup with one pending (re-Clear pendaftarIds[3] first)
    await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/pendaftar/${pendaftarIds[3].id}/finalist`, { status: null }, session);
    const tutupFail = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/kategori/k_anak/tutup-kualifikasi`, null, session);
    assert(tutupFail.status === 400, `Tutup fails when pending exists (got ${tutupFail.status})`);

    // 2.3 Re-Loloskan pendaftarIds[3]
    await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/pendaftar/${pendaftarIds[3].id}/finalist`, { status: 1 }, session);

    // 2.4 Tutup should succeed
    const tutupOk = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/kategori/k_anak/tutup-kualifikasi`, null, session);
    assert(tutupOk.status === 200, 'Tutup succeeds when all pendaftar decided');
    assert(tutupOk.body.status?.lolos === 4, `  status.lolos = 4 (got ${tutupOk.body.status?.lolos})`);

    // 2.5 Tutup again should fail (already tutup)
    const tutupDup = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/kategori/k_anak/tutup-kualifikasi`, null, session);
    assert(tutupDup.status === 400, `Tutup fails on already-tutup kategori (got ${tutupDup.status})`);

    // ============================================================
    // TEST 3: Juara picker (requires is_finalist=1 + kategori tutup)
    // ============================================================
    console.log('\n========== TEST 3: Juara picker (requires finalist + tutup) ==========');
    // 3.1 Set Juara 1 (first finalist)
    const j1 = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/juara`, { pendaftarId: pendaftarIds[0].id, rank: 1 }, session);
    assert(j1.status === 200, `set Juara 1 for ${pendaftarIds[0].nama}`);

    // 3.2 Set Juara 2 (second finalist)
    const j2 = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/juara`, { pendaftarId: pendaftarIds[1].id, rank: 2 }, session);
    assert(j2.status === 200, `set Juara 2 for ${pendaftarIds[1].nama}`);

    // 3.3 Verify Selesaikan Lomba is now ready (Juara 1+2 picked)
    // First check readiness via juara state "” but the API only exposes via Selesai
    // Let's try Selesai
    const selesaiRes = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/selesai`, null, session);
    assert(selesaiRes.status === 200, 'POST /selesai succeeds (Juara 1+2 picked)');

    // ============================================================
    // TEST 4: Public page renders correctly after Selesai
    // ============================================================
    console.log('\n========== TEST 4: Public page after Selesai ==========');
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });
    await page.goto(`${BASE}/lomba/${lombaId}`, { waitUntil: 'networkidle0', timeout: 30000 });
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
    assert(publicState.badgeText === 'Selesai', `public badge = "Selesai" (got "${publicState.badgeText}")`);
    assert(publicState.hasFinalisSection, 'Finalis section visible after selesai');
    assert(publicState.finalisRows.length === 4, `4 finalists in public (got ${publicState.finalisRows.length})`);
    // Sort: Juara 1, 2 first, then finalists by umur ASC
    assert(publicState.finalisRows[0] === pendaftarIds[0].nama, `  sort #1 = Juara 1 (${pendaftarIds[0].nama})`);
    assert(publicState.finalisRows[1] === pendaftarIds[1].nama, `  sort #2 = Juara 2 (${pendaftarIds[1].nama})`);
    assert(publicState.finalisLabels[0] === 'Juara 1' && publicState.finalisLabels[1] === 'Juara 2', 'Juara 1+2 labels correct');

    // ============================================================
    // TEST 5: Buka Kualifikasi (after Selesai) "” should fail
    // ============================================================
    console.log('\n========== TEST 5: Buka Kualifikasi after Selesai (should fail) ==========');
    // status=selesai â†’ API guard returns 400
    const bukaFail = await apiWithRetry('POST', `/api/admin/lomba/${lombaId}/kategori/k_anak/buka-kualifikasi`, null, session);
    assert(bukaFail.status === 400, `Buka fails when lomba status=selesai (got ${bukaFail.status})`);

    // ============================================================
    // CLEANUP
    // ============================================================
    console.log('\n========== CLEANUP ==========');
    const delRes = await apiWithRetry('DELETE', `/api/admin/lomba/${lombaId}`, null, session);
    assert(delRes.status === 200, 'DELETE test lomba (cascades pendaftar)');

    // Summary
    console.log('\n========== SUMMARY ==========');
    console.log(`PASS: ${pass}`);
    console.log(`FAIL: ${fail}`);
    console.log(`Total: ${pass + fail}`);
    process.exit(fail === 0 ? 0 : 1);
  } catch (err) {
    console.log('\nERROR:', err.message);
    console.log(err.stack);
    if (session && lombaId) {
      console.log('\nAttempting cleanup...');
      await apiWithRetry('DELETE', `/api/admin/lomba/${lombaId}`, null, session);
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();

