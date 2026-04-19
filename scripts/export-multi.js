/**
 * Export multiple double-elimination brackets (8, 16, 32 teams) for visual review.
 *
 * For each team count:
 *   1. Configure UI: bracket type = double, preset = N teams.
 *   2. Click Generate, wait for .bracket-container to render & stabilize.
 *   3. Take a full-page web screenshot -> {N}_team_double_web.png.
 *   4. Click in-page "PNG" button, wait for download, rename to {N}_team_double_export.png.
 *   5. Click back-to-setup to reset for the next iteration.
 *
 * PDF export is intentionally skipped (too slow, PNG is sufficient for review).
 *
 * Usage:
 *   VERIFY_URL=http://localhost:5174/bracket-generator/ node scripts/export-multi.js
 *   # VERIFY_URL defaults to port 5173 if unset.
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REVIEW_DIR = path.join(__dirname, 'screenshots', 'review');
const BASE_URL = process.env.VERIFY_URL || 'http://localhost:5173/bracket-generator/';

const TEAM_COUNTS = [8, 16, 32];

// ExportButtons names files from App.jsx's title state. Default title is "Tournament Bracket",
// which the export code converts via `title.replace(/\s+/g, '_')` to:
const DEFAULT_PNG = 'Tournament_Bracket.png';

if (!fs.existsSync(REVIEW_DIR)) {
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
}

/** Poll for a file to appear on disk. Returns once its size is stable (download finished). */
async function waitForDownload(filePath, timeoutMs = 20_000) {
  const start = Date.now();
  let lastSize = -1;
  let stableCount = 0;
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      // Need 3 consecutive polls at same nonzero size to call it "stable".
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

/** Remove a file if it exists. */
function rmIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function exportOneScenario(page, teamCount) {
  const webName = `${teamCount}_team_double_web.png`;
  const exportName = `${teamCount}_team_double_export.png`;
  const webPath = path.join(REVIEW_DIR, webName);
  const exportPath = path.join(REVIEW_DIR, exportName);
  const defaultPngPath = path.join(REVIEW_DIR, DEFAULT_PNG);

  // Clean stale files so waitForDownload sees a fresh drop.
  rmIfExists(webPath);
  rmIfExists(exportPath);
  rmIfExists(defaultPngPath);

  // Configure: double + N teams.
  await page.waitForSelector('[data-testid="bracket-type-double"]', { timeout: 10_000 });
  await page.click('[data-testid="bracket-type-double"]');
  await page.click(`[data-testid="preset-${teamCount}"]`);
  await new Promise(r => setTimeout(r, 150));
  await page.click('[data-testid="generate-bracket"]');
  await page.waitForSelector('.bracket-container', { timeout: 15_000 });
  // Let AutoScaleWrapper ResizeObserver settle.
  await new Promise(r => setTimeout(r, 800));

  // 1) Full-page web screenshot (captures ELIMINATION pill and surrounding UI).
  await page.screenshot({ path: webPath, fullPage: true });

  // 2) PNG export via in-page button. Find by visible text so it survives CSS changes.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'PNG');
    if (!btn) throw new Error('PNG button not found');
    btn.click();
  });
  await waitForDownload(defaultPngPath);
  fs.renameSync(defaultPngPath, exportPath);

  return { webPath, exportPath };
}

async function resetToSetup(page) {
  const backBtn = await page.$('[data-testid="back-to-setup"]');
  if (backBtn) {
    await backBtn.click();
    await page.waitForSelector('[data-testid="generate-bracket"]', { timeout: 10_000 });
    await new Promise(r => setTimeout(r, 200));
  }
}

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const outputs = [];

  try {
    const page = await browser.newPage();
    // Match verify-brackets.js viewport so bracket-container gets consistent
    // Letter-landscape dims on-screen (bracket height = calc(100vh - 160px)).
    await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 1 });

    // Redirect browser downloads into REVIEW_DIR via CDP.
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: REVIEW_DIR,
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 20_000 });

    for (const teamCount of TEAM_COUNTS) {
      console.log(`\n=== ${teamCount}-team double elimination ===`);
      await resetToSetup(page);
      const { webPath, exportPath } = await exportOneScenario(page, teamCount);
      outputs.push({ teamCount, webPath, exportPath });
      console.log(`  WEB     ${webPath}`);
      console.log(`  EXPORT  ${exportPath}`);
    }
  } finally {
    await browser.close();
  }

  console.log('\n===== DONE =====');
  outputs.forEach(({ teamCount, webPath, exportPath }) => {
    console.log(`${teamCount}  ${webPath}`);
    console.log(`${teamCount}  ${exportPath}`);
  });
}

run().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
