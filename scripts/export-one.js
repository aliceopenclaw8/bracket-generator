/**
 * Export a single 16-team double-elimination bracket for visual review.
 *
 * Flow:
 *   1. Launches a Puppeteer browser pointed at the running Vite dev server.
 *   2. Configures: bracket type = double, preset = 16 teams.
 *   3. Clicks Generate, waits for .bracket-container to render & stabilize.
 *   4. Takes a full-page web screenshot (captures the on-screen UI including
 *      the ELIMINATION pill above the bracket).
 *   5. Clicks the in-page PNG export button, waits for the download.
 *   6. Clicks the in-page PDF export button, waits for the download.
 *   7. Renames downloaded files (default name is "Tournament_Bracket.{png,pdf}")
 *      to the final names the caller expects.
 *
 * Usage:
 *   VERIFY_URL=http://localhost:5174/bracket-generator/ node scripts/export-one.js
 *   # VERIFY_URL defaults to port 5173 if unset.
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REVIEW_DIR = path.join(__dirname, 'screenshots', 'review');
const BASE_URL = process.env.VERIFY_URL || 'http://localhost:5173/bracket-generator/';

const WEB_NAME = '16_team_double_web.png';
const EXPORT_PNG_NAME = '16_team_double_export.png';
const EXPORT_PDF_NAME = '16_team_double_export.pdf';
// ExportButtons names files from the title state in App.jsx (default: "Tournament Bracket").
// The button code does `title.replace(/\s+/g, '_')`, giving:
const DEFAULT_PNG = 'Tournament_Bracket.png';
const DEFAULT_PDF = 'Tournament_Bracket.pdf';

if (!fs.existsSync(REVIEW_DIR)) {
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
}

/** Poll for a file to appear on disk. Returns when size is stable (download finished). */
async function waitForDownload(filePath, timeoutMs = 20_000) {
  const start = Date.now();
  let lastSize = -1;
  let stableCount = 0;
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      // Need 3 consecutive polls with same nonzero size to call it "stable".
      if (size > 0 && size === lastSize) {
        stableCount++;
        if (stableCount >= 3) return size;
      } else {
        stableCount = 0;
      }
      lastSize = size;
    }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`Download timed out for ${filePath}`);
}

async function run() {
  // Clean any stale default-named files from prior runs so waitForDownload works.
  for (const name of [DEFAULT_PNG, DEFAULT_PDF, EXPORT_PNG_NAME, EXPORT_PDF_NAME]) {
    const p = path.join(REVIEW_DIR, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    // Match verify-brackets.js viewport so the bracket container gets the same
    // Letter-landscape dims on-screen (bracket height = calc(100vh - 160px)).
    await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 1 });

    // Redirect browser downloads into REVIEW_DIR via CDP.
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: REVIEW_DIR,
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 20_000 });

    // Configure: double + 16.
    await page.waitForSelector('[data-testid="bracket-type-double"]', { timeout: 10_000 });
    await page.click('[data-testid="bracket-type-double"]');
    await page.click('[data-testid="preset-16"]');
    await new Promise(r => setTimeout(r, 150));
    await page.click('[data-testid="generate-bracket"]');
    await page.waitForSelector('.bracket-container', { timeout: 15_000 });
    // Let AutoScaleWrapper ResizeObserver settle.
    await new Promise(r => setTimeout(r, 800));

    // 1) Full-page web screenshot (shows ELIMINATION pill etc.)
    const webPath = path.join(REVIEW_DIR, WEB_NAME);
    await page.screenshot({ path: webPath, fullPage: true });

    // 2) PNG export via the in-page button. Find by visible text to survive CSS changes.
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'PNG');
      if (!btn) throw new Error('PNG button not found');
      btn.click();
    });
    await waitForDownload(path.join(REVIEW_DIR, DEFAULT_PNG));
    fs.renameSync(path.join(REVIEW_DIR, DEFAULT_PNG), path.join(REVIEW_DIR, EXPORT_PNG_NAME));

    // 3) PDF export.
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'PDF');
      if (!btn) throw new Error('PDF button not found');
      btn.click();
    });
    await waitForDownload(path.join(REVIEW_DIR, DEFAULT_PDF));
    fs.renameSync(path.join(REVIEW_DIR, DEFAULT_PDF), path.join(REVIEW_DIR, EXPORT_PDF_NAME));

    console.log('WEB  ', webPath);
    console.log('PNG  ', path.join(REVIEW_DIR, EXPORT_PNG_NAME));
    console.log('PDF  ', path.join(REVIEW_DIR, EXPORT_PDF_NAME));
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
