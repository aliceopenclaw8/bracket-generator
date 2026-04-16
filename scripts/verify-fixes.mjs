/**
 * Verification script for Stuart's 5 reported issues.
 * Generates screenshots and PDFs for visual review.
 *
 * Usage: node scripts/verify-fixes.mjs
 * Outputs to review/ folder. Starts/stops its own dev server.
 */
import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { mkdir, readdir, rename } from 'fs/promises';
import path from 'path';

const REVIEW_DIR = path.resolve('./review');
const PORT = 5179;
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── helpers ──────────────────────────────────────────────────────────

async function waitForServer(url, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await sleep(500);
  }
  throw new Error(`Server did not start within ${timeout}ms`);
}

/** Click button by partial text match (case-insensitive). Throws if not found. */
async function click(page, text) {
  const found = await page.evaluate((t) => {
    const lower = t.toLowerCase();
    const btn = [...document.querySelectorAll('button')].find(
      b => b.textContent.trim().toLowerCase().includes(lower)
    );
    if (btn) { btn.click(); return true; }
    return false;
  }, text);
  if (!found) throw new Error(`Button "${text}" not found on page`);
  await sleep(400);
}

async function setCustomTeams(page, count) {
  // Clear and type into the custom count input
  await page.evaluate((c) => {
    const input = document.querySelector('input[placeholder="Custom # of teams"]');
    if (!input) throw new Error('Custom count input not found');
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(input, String(c));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, count);
  await sleep(200);
  await click(page, 'Set');
  await sleep(400);
}

async function setupDownloads(page) {
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: REVIEW_DIR,
  });
}

/** Wait for a button containing `text` to appear in the DOM (up to 10s). */
async function waitForButton(page, text, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const exists = await page.evaluate((t) => {
      return [...document.querySelectorAll('button')].some(
        b => b.textContent.trim().toLowerCase().includes(t.toLowerCase())
      );
    }, text);
    if (exists) return;
    await sleep(300);
  }
  throw new Error(`Button "${text}" did not appear within ${timeout}ms`);
}

async function exportPDF(page, outputName) {
  await waitForButton(page, 'PDF');
  await click(page, 'PDF');
  // jsPDF generates a blob download — wait for file to write
  await sleep(4000);
  // Rename from default "Tournament_Bracket.pdf" to scenario-specific name
  const src = path.join(REVIEW_DIR, 'Tournament_Bracket.pdf');
  const dst = path.join(REVIEW_DIR, `${outputName}.pdf`);
  try { await rename(src, dst); } catch {}
}

// ── scenarios ────────────────────────────────────────────────────────

async function run1_18teamSEDS(page) {
  console.log('  [1/5] 18-team SE Double-Sided → PDF + screenshot');
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await setCustomTeams(page, 18);
  await click(page, 'Double-Sided');
  await click(page, 'Generate Bracket');
  await sleep(800);
  await page.screenshot({ path: `${REVIEW_DIR}/1_18team_SE_DS_screen.png`, fullPage: true });
  await exportPDF(page, '1_18team_SE_DS');
  console.log('    ✓ done');
}

async function run2_blankMode(page) {
  console.log('  [2/5] Blank mode toggle → screenshots');
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await click(page, '16 Teams');
  await page.screenshot({ path: `${REVIEW_DIR}/2_blank_before.png`, fullPage: true });
  await click(page, 'Blank');
  await sleep(300);
  await page.screenshot({ path: `${REVIEW_DIR}/2_blank_after.png`, fullPage: true });
  await click(page, 'Generate Blank');
  await sleep(800);
  await page.screenshot({ path: `${REVIEW_DIR}/2_blank_bracket.png`, fullPage: true });
  await exportPDF(page, '2_blank_bracket');
  console.log('    ✓ done');
}

async function run3_64teamSEDS(page) {
  console.log('  [3/5] 64-team SE Double-Sided → PDF + screenshot');
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await setCustomTeams(page, 64);
  await click(page, 'Double-Sided');
  await click(page, 'Generate Bracket');
  await sleep(2000); // 64-team bracket needs extra render time
  await page.screenshot({ path: `${REVIEW_DIR}/3_64team_SE_DS_screen.png`, fullPage: true });
  await exportPDF(page, '3_64team_SE_DS');
  console.log('    ✓ done');
}

async function run4_compactOptions(page) {
  console.log('  [4/5] Compact options layout → screenshot');
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1280, height: 900 });
  await sleep(400);
  await page.screenshot({ path: `${REVIEW_DIR}/4_compact_options.png`, fullPage: true });
  // Reset viewport for remaining scenarios
  await page.setViewport({ width: 1440, height: 900 });
  console.log('    ✓ done');
}

async function run5_DE16(page) {
  console.log('  [5/5] DE 16-team → PDF + screenshot');
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await click(page, '16 Teams');
  await click(page, 'Double Elim');
  await click(page, 'Generate Bracket');
  await sleep(800);
  await page.screenshot({ path: `${REVIEW_DIR}/5_DE_16team_screen.png`, fullPage: true });
  await exportPDF(page, '5_DE_16team');
  console.log('    ✓ done');
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Verifying 5 fixes...\n');
  await mkdir(REVIEW_DIR, { recursive: true });

  // Start dev server
  console.log(`Starting dev server on :${PORT}...`);
  const server = spawn('npx', ['vite', '--port', String(PORT)], {
    stdio: 'pipe', cwd: process.cwd(),
  });
  server.stderr.on('data', d => {
    const s = d.toString();
    if (s.toLowerCase().includes('error')) console.error('  [vite]', s.trim());
  });

  let browser;
  try {
    await waitForServer(BASE);
    console.log('Server ready.\n');

    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await setupDownloads(page);

    // Dismiss any alert/confirm dialogs automatically (legibility warning for large brackets)
    page.on('dialog', async dialog => { await dialog.accept(); });

    await run1_18teamSEDS(page);
    await run2_blankMode(page);
    await run3_64teamSEDS(page);
    await run4_compactOptions(page);
    await run5_DE16(page);

    await browser.close();
    browser = null;

    // List output files
    const files = await readdir(REVIEW_DIR);
    console.log(`\n✓ All done! Files in ${REVIEW_DIR}/:`);
    files.sort().forEach(f => console.log(`  ${f}`));

    console.log('\nReview checklist:');
    console.log('  1. 1_18team_SE_DS — PDF: no outline, bracket fills page');
    console.log('  2. 2_blank_* — setup hides names, bracket shows empty slots');
    console.log('  3. 3_64team_SE_DS — PDF: less horizontal white space');
    console.log('  4. 4_compact_options — all toggles in one row');
    console.log('  5. 5_DE_16team — losers bracket has 6 rounds (was 5)');
  } catch (err) {
    console.error('\nFailed:', err.message);
    if (browser) await browser.close().catch(() => {});
    throw err;
  } finally {
    server.kill('SIGTERM');
    console.log('Server stopped.');
  }
}

main().catch(() => process.exit(1));
