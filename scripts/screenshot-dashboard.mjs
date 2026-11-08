// Ejecutar con VITE_MOCK=1 npm run dev. No usa cookies ni producción.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = '/tmp/deleg/tablero';
await mkdir(directory, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', headless: true, pipe: true });
const report = [];
try {
  for (const [width, height] of [[1366, 768], [1920, 1080], [390, 844]]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage(), errors = [];
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.hostname !== '127.0.0.1' || url.pathname.startsWith('/api/')) { request.respond({ status: 200, contentType: 'text/css', body: '' }); return; }
      request.continue();
    });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.evaluateOnNewDocument(mode => localStorage.setItem('protektor-theme', mode), theme);
    await page.goto('http://127.0.0.1:5173/v2/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="kpi-all"]');
    assert.equal(await page.$eval('[data-testid="kpi-all"] strong', e => e.textContent), '150');
    const ids = await page.$$eval('.fleet-kpi', elements => elements.map(e => e.dataset.testid));
    for (const id of ids) {
      const count = await page.$eval(`[data-testid="${id}"] strong`, e => e.textContent);
      await page.click(`[data-testid="${id}"]`);
      await page.waitForFunction(expected => document.querySelector('[data-testid="results"]').textContent === `${expected} resultados`, {}, count);
    }
    await page.click('[data-testid="kpi-all"]');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Scroll horizontal');
    await page.screenshot({ path: `${directory}/${width}x${height}-${theme}.png` });
    assert.deepEqual(errors, []);
    report.push({ width, height, theme, errors, horizontalOverflow: false, kpis: 'consistent' });
    await page.close();
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(report, null, 2));
  console.log(report);
} finally { await browser.close(); }
