// Fix kategori ID/nama mismatch via admin API
// Current state: k_anak=Balita(2-5), k_remaja=Anak(6-13)
// Target:        k_balita=Balita(2-5), k_anak=Anak(6-13)
// Steps:
//   1. Create k_balita with Balita data
//   2. Update k_anak to have Anak data
//   3. PATCH each lomba: replace k_anak→k_balita, k_remaja→k_anak in both
//      kategoriEligible and pjList
//   4. DELETE k_remaja (no longer used)

const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('https://lomba-app.vercel.app/admin/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="password"]', 'lomba123');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);

    const result = await page.evaluate(async () => {
      const log = [];

      // 1. Snapshot current state
      const katsRes = await fetch('/api/admin/kategori');
      const katsJson = await katsRes.json();
      const kats = katsJson.data;
      log.push(`Step 1: Found ${kats.length} kategori`);
      const oldAnak = kats.find(k => k.id === 'k_anak');
      const oldRemaja = kats.find(k => k.id === 'k_remaja');
      const oldDewasa = kats.find(k => k.id === 'k_dewasa');
      log.push(`  - k_anak: nama=${oldAnak.nama}, ${oldAnak.min}-${oldAnak.max}`);
      log.push(`  - k_remaja: nama=${oldRemaja.nama}, ${oldRemaja.min}-${oldRemaja.max}`);
      log.push(`  - k_dewasa: nama=${oldDewasa.nama}, ${oldDewasa.min}-${oldDewasa.max}`);

      // 2. Create k_balita with Balita data
      const createRes = await fetch('/api/admin/kategori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'k_balita',
          nama: oldAnak.nama,        // 'Balita'
          icon: oldAnak.icon,        // 'fa-baby'
          min: oldAnak.min,          // 2
          max: oldAnak.max,          // 5
          urutan: oldAnak.urutan,    // 1
          autoAge: oldAnak.autoAge,
        }),
      });
      const createJson = await createRes.json();
      log.push(`Step 2: Create k_balita → ${createRes.status} ${JSON.stringify(createJson)}`);

      // 3. Update k_anak to have Anak data (overwriting the old Balita data)
      const updateRes = await fetch('/api/admin/kategori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'k_anak',
          nama: oldRemaja.nama,      // 'Anak'
          icon: oldRemaja.icon,      // 'fa-user'
          min: oldRemaja.min,        // 6
          max: oldRemaja.max,        // 13
          urutan: oldRemaja.urutan,  // 2
          autoAge: oldRemaja.autoAge,
        }),
      });
      const updateJson = await updateRes.json();
      log.push(`Step 3: Update k_anak → ${updateRes.status} ${JSON.stringify(updateJson)}`);

      // 4. PATCH each lomba: replace k_anak→k_balita, k_remaja→k_anak
      const lomRes = await fetch('/api/admin/lomba');
      const lomJson = await lomRes.json();
      const lomba = lomJson.data || [];
      log.push(`Step 4: Found ${lomba.length} lomba to update`);

      for (const l of lomba) {
        const newKat = (l.kategoriEligible || []).map(k =>
          k === 'k_anak' ? 'k_balita' : k === 'k_remaja' ? 'k_anak' : k
        );
        const newPjList = (() => {
          // Build pjList from pjByKategori, mapping keys
          const map = {};
          for (const [oldK, pj] of Object.entries(l.pjByKategori || {})) {
            const newK = oldK === 'k_anak' ? 'k_balita' : oldK === 'k_remaja' ? 'k_anak' : oldK;
            map[newK] = pj;
          }
          return newKat.map(k => ({
            kategoriId: k,
            pjNama: map[k]?.nama || 'Panitia',
            pjKontak: map[k]?.kontak || null,
          }));
        })();

        // Skip if no actual change
        const sameKat = JSON.stringify(newKat.sort()) === JSON.stringify([...l.kategoriEligible].sort());
        if (sameKat && newKat.every(k => l.pjByKategori?.[k])) {
          log.push(`  Skip ${l.nama} (no change needed)`);
          continue;
        }

        const patchRes = await fetch(`/api/admin/lomba/${l.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kategoriEligible: newKat,
            pjList: newPjList,
          }),
        });
        const patchJson = await patchRes.json();
        log.push(`  PATCH ${l.nama} (${l.id}) → ${patchRes.status} ${JSON.stringify(patchJson)}`);
      }

      // 5. Verify final state
      const finalKats = await (await fetch('/api/admin/kategori')).json();
      log.push(`Step 5: Final kategori:`);
      for (const k of finalKats.data) {
        log.push(`  - ${k.id}: nama=${k.nama}, ${k.min}-${k.max}`);
      }

      // 6. Delete k_remaja (no longer used)
      const delRes = await fetch(`/api/admin/kategori?id=k_remaja`, { method: 'DELETE' });
      const delJson = await delRes.json();
      log.push(`Step 6: DELETE k_remaja → ${delRes.status} ${JSON.stringify(delJson)}`);

      return log;
    });

    for (const line of result) console.log(line);
  } finally {
    await browser.close();
  }
})();
