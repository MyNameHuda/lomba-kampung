// Set sensible default colors for all 3 kategori
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

    const colors = {
      k_balita: { bg: '#FCE7F3', text: '#9F1239', border: '#FBCFE8' }, // pink
      k_anak:   { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' }, // yellow
      k_dewasa: { bg: '#a7dde0', text: '#093a3e', border: '#3aafb9' }, // teal
    };

    for (const [id, c] of Object.entries(colors)) {
      const r = await page.evaluate(async (id, c) => {
        // Get current values to preserve other fields
        const kats = await (await fetch('/api/admin/kategori')).json();
        const k = kats.data.find((x) => x.id === id);
        const res = await fetch('/api/admin/kategori', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: k.id, nama: k.nama, icon: k.icon, min: k.min, max: k.max,
            urutan: k.urutan, autoAge: k.autoAge,
            colorBg: c.bg, colorText: c.text, colorBorder: c.border,
          }),
        });
        return { status: res.status };
      }, id, c);
      console.log(`${id}: ${r.status}`);
    }
  } finally {
    await browser.close();
  }
})();
