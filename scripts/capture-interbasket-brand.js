/**
 * Captures interbasket.net brand identity using authenticated browser session.
 * Reads credentials from .env.local. Outputs JSON + a screenshot.
 *
 * Usage: node scripts/capture-interbasket-brand.js
 */
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const ENV_PATH = '.env.local';
if (!fs.existsSync(ENV_PATH)) {
  console.error('Missing .env.local at repo root. Aborting.');
  process.exit(1);
}

// Tiny .env parser — accepts KEY=value, KEY='value', and KEY="value" forms.
// Single-quoted regex from the spec was too strict for the actual file (unquoted values).
const env = {};
fs.readFileSync(ENV_PATH, 'utf8').split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) return;
  let value = m[2];
  // Strip matching surrounding quotes (single or double) if present.
  if ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  }
  env[m[1]] = value;
});

const SITE_URL = 'https://www.interbasket.net/';
const ADMIN_URL = env.INTERBASKET_WP_ADMIN_URL;
const USER = env.INTERBASKET_WP_USER;
const PASS = env.INTERBASKET_WP_PASS;

if (!ADMIN_URL || !USER || !PASS) {
  console.error('Missing INTERBASKET_WP_* in .env.local. Aborting.');
  process.exit(1);
}

const OUT_DIR = path.join('scripts', 'brand-capture');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Cloudflare detects headless Chrome via the HeadlessChrome user-agent and several JS fingerprints.
// Using headless: false (visible browser) plus a real user-agent gets past the simple JS challenge.
// If Cloudflare's full Turnstile challenge appears, it can be solved manually — we just need a
// human present to click the checkbox. Spec calls this out as an acceptable escalation path.
const HEADFUL = process.env.HEADFUL !== '0'; // default true; set HEADFUL=0 to force headless
const browser = await puppeteer.launch({
  headless: HEADFUL ? false : 'new',
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.setUserAgent(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
);

// 1. Visit public homepage first to capture front-end CSS
await page.goto(SITE_URL, { waitUntil: 'networkidle2', timeout: 60_000 });

// If we landed on a Cloudflare challenge page, wait until it clears.
// Cloudflare's interstitial reload navigates the page when the challenge passes,
// so we poll a known "real homepage" marker rather than racing on navigation events.
async function waitForRealHomepage(maxMs = 120_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const isReal = await page.evaluate(() => {
      const bodyText = document.body?.innerText || '';
      const onChallenge = /verifying you are human|security verification|just a moment|attention required/i.test(bodyText);
      if (onChallenge) return false;
      // Real WordPress pages: have body classes, or generator meta, or content > 500 chars
      const bodyClassCount = document.body?.classList?.length || 0;
      const hasGenerator = !!document.querySelector('meta[name="generator"]');
      return bodyClassCount > 0 || hasGenerator || bodyText.length > 500;
    });
    if (isReal) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

const challengeCleared = await waitForRealHomepage(120_000);
if (!challengeCleared) {
  console.error('Cloudflare challenge did not clear within 120s. Capturing diagnostic screenshot anyway.');
}

// Settle: small wait for any final paint/font load.
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: path.join(OUT_DIR, 'interbasket-home.png'), fullPage: false });

// 2. Capture computed styles for key elements
const tokens = await page.evaluate(() => {
  function get(sel, props) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const result = {};
    props.forEach(p => { result[p] = cs[p]; });
    return result;
  }
  return {
    body: get('body', ['backgroundColor', 'color', 'fontFamily', 'fontSize']),
    heading: get('h1, h2', ['color', 'fontFamily', 'fontWeight', 'fontSize']),
    link: get('a', ['color']),
    button: get('button, .button, input[type=submit]', ['backgroundColor', 'color', 'borderRadius']),
    nav: get('nav, .menu, #masthead', ['backgroundColor', 'color']),
  };
});

// 3. Detect platform: WP, phpBB, or hybrid
const platformSignals = await page.evaluate(() => ({
  hasWpGenerator: !!document.querySelector('meta[name="generator"][content*="WordPress"]'),
  generatorMeta: document.querySelector('meta[name="generator"]')?.content || null,
  hasWpAdminBar: !!document.getElementById('wpadminbar'),
  bodyClasses: document.body.className,
  hasPhpBB: !!document.querySelector('body[id^="phpbb"], .phpbb, #wrap'),
}));

// 4. Verify WP admin login works (definitive WP confirmation)
let wpAdminConfirmed = false;
try {
  await page.goto(ADMIN_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
  await page.waitForSelector('#user_login', { timeout: 10_000 });
  await page.type('#user_login', USER);
  await page.type('#user_pass', PASS);
  await Promise.all([
    page.click('#wp-submit'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }),
  ]);
  wpAdminConfirmed = !!(await page.$('#wpadminbar')) || page.url().includes('wp-admin');
} catch (e) {
  console.error('WP admin login failed:', e.message);
}

const report = {
  capturedAt: new Date().toISOString(),
  url: SITE_URL,
  platformSignals,
  wpAdminConfirmed,
  tokens,
};

fs.writeFileSync(path.join(OUT_DIR, 'interbasket-tokens.json'), JSON.stringify(report, null, 2));
console.log('Captured to', OUT_DIR);
console.log(JSON.stringify(report, null, 2));

await browser.close();
