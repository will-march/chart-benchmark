/**
 * Playwright runner for benchmark.html
 *
 * Usage:
 *   node run-benchmark.js [--headed]
 *
 * Saves results.json and prints a markdown table.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir  = dirname(fileURLToPath(import.meta.url));
const HTML   = 'file://' + join(__dir, 'benchmark.html');
const headed = process.argv.includes('--headed');

async function main() {
  const browser = await chromium.launch({
    headless: !headed,
    args: ['--enable-gpu', '--use-gl=angle', '--disable-gpu-sandbox', '--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('Loading benchmark page…');
  await page.goto(HTML, { waitUntil: 'networkidle' });

  console.log('Running benchmark (~2 min)…');
  await page.click('#runBtn');

  await page.waitForSelector('#benchmark-results', { timeout: 300_000 });

  const rawJson = await page.$eval('#benchmark-results', el => el.textContent ?? '');
  const data    = JSON.parse(rawJson);

  writeFileSync(join(__dir, 'results.json'), JSON.stringify(data, null, 2));
  console.log('\nSaved results.json\n');

  printMarkdown(data);
  await browser.close();
}

function printMarkdown(data) {
  const libs   = [...new Set(data.results.map(r => r.library))];
  const counts = [...new Set(data.results.map(r => r.candles))];
  const byKey  = Object.fromEntries(data.results.map(r => [`${r.library}:${r.candles}`, r]));

  const cell = (lib, count, fn) => {
    const r = byKey[`${lib}:${count}`];
    try { return r ? String(fn(r)) : '—'; } catch { return '—'; }
  };

  console.log(`## Benchmark results — ${data.date.slice(0, 10)}\n`);
  console.log(`**UA:** ${data.ua}`);
  console.log(`**Note:** ${data.note}\n`);

  const headers = ['setData (ms)', 'Pan p50 (ms)', 'Pan p95 (ms)', 'Pan max (ms)',
                   'Zoom p50 (ms)', 'Zoom p95 (ms)', 'Eff FPS pan'];
  const fns     = [
    r => r.setDataMs,
    r => r.pan.p50,
    r => r.pan.p95,
    r => r.pan.max,
    r => r.zoom.p50,
    r => r.zoom.p95,
    r => `${Math.min(60, Math.round(1000 / Math.max(r.pan.p50, 0.01)))} fps`,
  ];

  for (let i = 0; i < headers.length; i++) {
    console.log(`### ${headers[i]}\n`);
    console.log(`| Candles | ${libs.join(' | ')} |`);
    console.log(`|${'---|'.repeat(libs.length + 1)}`);
    for (const count of counts) {
      const cells = libs.map(lib => cell(lib, count, fns[i]));
      console.log(`| ${count.toLocaleString()} | ${cells.join(' | ')} |`);
    }
    console.log();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
