// Re-fix lomba.kategoriEligible using pjByKategori (which is correct) as source
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
    const log = await page.evaluate(async () => {
      const out = [];
      const r = await fetch('/api/admin/lomba');
      const j = await r.json();
      const lomba = j.data || [];
      out.push(`Found ${lomba.length} lomba`);

      for (const l of lomba) {
        // pjByKategori is correct (was updated via setLombaKategori which works)
        // Use its keys as the source of truth for kategoriEligible
        const newKat = Object.keys(l.pjByKategori || {});
        if (newKat.length === 0) {
          out.push(`  Skip ${l.nama} (no PJ)`);
          continue;
        }
        const newPjList = newKat.map(k => ({
          kategoriId: k,
          pjNama: l.pjByKategori[k]?.nama || 'Panitia',
          pjKontak: l.pjByKategori[k]?.kontak || null,
        }));
        const pr = await fetch(`/api/admin/lomba/${l.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kategoriEligible: newKat, pjList: newPjList }),
        });
        const pj = await pr.json();
        out.push(`  PATCH ${l.nama} (${l.id}) → ${pr.status} new kategoriEligible=[${newKat.join(',')}]`);
      }
      return out;
    });
    for (const l of log) console.log(l);
  } finally {
    await browser.close();
  }
})();
