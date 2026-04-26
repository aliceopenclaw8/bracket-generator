# WordPress Shortcode Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a WordPress shortcode plugin (`[bracket-generator theme="..." ads="..."]`) that embeds the React bracket generator inline on Stuart Leung's two WordPress sites (interbasket.net + printerfriend.ly), with brand-matched theme variants per site, optional ad slots that wrap his existing `[gard]` AdSense shortcode, and a feedback mailto link. Stuart owns SEO copy in WordPress; we ship the tool.

**Architecture:** A PHP plugin registers `[bracket-generator]`, emits an HTML wrapper with optional ad slots (server-side `do_shortcode('[gard]')`), and a uniquely-IDed React mount div carrying `data-theme`. The Vite-built JS bundle exposes `window.BracketGenerator.mount(container)` which reads the data attribute and renders the React app into that container. Tailwind v4 preflight is scoped so it doesn't smash the WP theme. Two Vite build modes — dev (auto-mounts to `#bracket-root`) and plugin (single-bundle, relative paths, outputs into plugin folder).

**Tech Stack:** Vite 8, React 19, Tailwind v4 (`@tailwindcss/vite`), html2canvas + jsPDF (existing), Puppeteer 24 (verification), PHP 7.4+ (WP plugin runtime)

**Companion spec:** `PACKAGING.md` at repo root — single source of truth for the WP integration architecture, scope decisions, and brand recon. This plan is the executable derivation of that spec.

**Reference context for the engineer:**
- We do **not** host the SPA. Stuart hosts everything on his cPanel-based WP install (hosting.com).
- WP credentials are in `.env.local` (gitignored via `*.local`). Use them for Puppeteer brand recon and real-site install testing — never commit them.
- Stuart writes SEO copy in WordPress (Classic Editor + Yoast). We don't render SEO content.
- The `[gard]` shortcode comes from Stuart's existing AdSense plugin; we don't ship it. Our plugin only references it via `do_shortcode()`.

---

## File Structure

**New files:**
- `wp-plugin/bracket-generator/bracket-generator.php` — Plugin entry, shortcode registration, asset enqueue, instance counter
- `wp-plugin/bracket-generator/INSTALL.md` — Install + setup guide for Stuart
- `wp-plugin/bracket-generator/dist/` — Build output destination (created by Vite)
- `scripts/capture-interbasket-brand.js` — Puppeteer script: log into interbasket WP admin, capture computed CSS for theme palette
- `scripts/build-plugin.js` — Build pipeline: invoke Vite plugin-mode build (via API), then zip plugin folder
- `scripts/wp-test-page.html` — Fake WP page used for Tailwind isolation spike + multi-instance verification
- `docs/superpowers/plans/2026-04-27-wordpress-shortcode-plugin.md` — This file

**Modified files:**
- `src/main.jsx` — Refactor to expose `mount(container, options)` function on `window.BracketGenerator`, keep dev auto-mount as a fallback
- `src/App.jsx` — Accept `initialTheme` and `feedbackUrl` props; render feedback link in a footer
- `src/utils/themes.js` — Add `printerfriend` and `interbasket` theme entries
- `src/index.css` — Scope Tailwind preflight to `#bracket-root, .bracket-generator-mount` so it doesn't reset WP theme styling
- `vite.config.js` — Mode-based config: dev mode unchanged, `plugin` mode uses relative base + single-bundle output → `wp-plugin/bracket-generator/dist/`
- `package.json` — Add `build:plugin`, `build:plugin:zip`, `capture:brand` scripts; add `archiver` to devDependencies
- `.gitignore` — Add `wp-plugin/bracket-generator/dist/`, `*.zip`, `scripts/brand-capture/`
- `index.html` — Rename `<div id="root">` → `<div id="bracket-root">` for preflight-scoping consistency

**Files to leave alone:**
- All `src/components/*` — components consume `theme` as a prop; no changes needed
- `src/utils/bracketLogic.js`, `src/utils/shuffle.js` — pure logic, unaffected
- `scripts/verify-brackets.js` — existing Puppeteer verification still applies to dev mode; plugin verification is separate

---

## Task 1: Capture interbasket.net brand identity via Puppeteer

**Why this is first:** Task 6 (theme variants) needs concrete color/font tokens for the `interbasket` theme. The earlier search-specialist subagent was blocked by Cloudflare and only inferred (didn't verify). With WP admin credentials in `.env.local`, Puppeteer can solve Cloudflare's challenge naturally and capture real CSS values. This task ALSO empirically confirms interbasket runs WordPress (mitigating the phpBB risk flagged in PACKAGING.md).

**Files:**
- Create: `scripts/capture-interbasket-brand.js`
- Modify: `package.json` (add `capture:brand` script)
- Modify: `.gitignore` (ignore capture artifacts)
- Modify: `PACKAGING.md` (update "interbasket.net — TBD" section with captured values)

- [ ] **Step 1: Create the Puppeteer capture script**

Create `scripts/capture-interbasket-brand.js`:

```js
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

// Tiny .env parser — single-quoted values, KEY='value' format
const env = {};
fs.readFileSync(ENV_PATH, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)='(.+)'$/);
  if (m) env[m[1]] = m[2];
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

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

// 1. Visit public homepage first to capture front-end CSS
await page.goto(SITE_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
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
```

- [ ] **Step 2: Add npm script**

Modify `package.json` to add to scripts block:

```json
"capture:brand": "node scripts/capture-interbasket-brand.js"
```

- [ ] **Step 3: Add output dir to .gitignore**

Append to `.gitignore`:

```
# Brand capture artifacts (regenerated by `npm run capture:brand`)
scripts/brand-capture/
```

- [ ] **Step 4: Run the script and verify output**

Run: `npm run capture:brand`

Expected output:
- `scripts/brand-capture/interbasket-home.png` exists
- `scripts/brand-capture/interbasket-tokens.json` exists with non-null `tokens` and `wpAdminConfirmed: true`
- Console prints platformSignals showing `hasWpGenerator: true` OR `wpAdminConfirmed: true`

If `wpAdminConfirmed` is `false` AND `platformSignals.hasWpGenerator` is `false`: the phpBB risk has materialized — STOP, ask Swee how to proceed (likely Path B fallback for interbasket only).

- [ ] **Step 5: Update PACKAGING.md with captured values**

Open `PACKAGING.md`, find the section "interbasket.net — TBD". Replace with a table containing the verified token values from `interbasket-tokens.json`. Format mirrors the printerfriend.ly table directly above it.

- [ ] **Step 6: Commit**

```bash
git add scripts/capture-interbasket-brand.js package.json .gitignore PACKAGING.md
git commit -m "feat(scripts): capture interbasket brand identity via Puppeteer"
```

---

## Task 2: Tailwind preflight isolation spike

**Why this is second:** This is the highest engineering risk in the entire plan. Tailwind v4's preflight resets `h1`/`h2`/`button`/`a`/etc. globally. If we ship the bundle as-is into a WP page, it'll smash the theme's typography and link styling. The fix needs to scope all base-layer resets to `#bracket-root` only. If this spike fails, the architecture changes (Shadow DOM fallback). Solve it before scaffolding the plugin.

**Files:**
- Create: `scripts/wp-test-page.html` (fake WP-like page used to verify isolation)
- Modify: `src/index.css`
- Modify: `index.html` (rename mount ID)
- Modify: `src/main.jsx` line 6 (match new mount ID)

- [ ] **Step 1: Create a fake-WP test page**

Create `scripts/wp-test-page.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Fake WP Page — Isolation Test</title>
  <!-- Simulate a WP theme's base styling -->
  <style>
    body { font-family: Georgia, serif; background: #fafafa; color: #222; max-width: 900px; margin: 2rem auto; padding: 1rem; line-height: 1.6; }
    h1 { color: #2a5a8a; font-size: 2.2rem; border-bottom: 2px solid #2a5a8a; padding-bottom: 0.3rem; }
    h2 { color: #444; font-size: 1.6rem; margin-top: 2rem; }
    a { color: #c0392b; text-decoration: underline; }
    button { background: #2a5a8a; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
  </style>
</head>
<body>
  <h1>Fake WP Theme Page</h1>
  <p>This paragraph and the surrounding <a href="#">links</a>, <button>buttons</button>, and headings should retain their WP-theme styling AFTER the bracket-generator bundle loads. If they reset to Tailwind defaults (browser sans-serif, no underline on links, no button background), preflight isolation has failed.</p>

  <h2>Section before bracket</h2>
  <p>More content with a <a href="#">styled link</a>.</p>

  <!-- Bracket mount -->
  <div id="bracket-root" class="bracket-generator-mount" data-theme="bw"></div>

  <h2>Section after bracket</h2>
  <p>Same styling expectations: link should still be red and underlined, button should still be blue.</p>
  <p><a href="#">After-link</a> and <button>After-button</button>.</p>

  <!-- Load the built plugin bundle. After Task 7+ this path is stable. -->
  <script type="module" src="../wp-plugin/bracket-generator/dist/bracket-generator.js"></script>
</body>
</html>
```

- [ ] **Step 2: Rename mount ID in dev shell**

Modify `index.html` line 10:

```html
<div id="bracket-root"></div>
```

Modify `src/main.jsx` line 6:

```jsx
createRoot(document.getElementById('bracket-root')).render(
```

This aligns dev and plugin mount IDs so the same preflight scoping rules apply in both.

- [ ] **Step 3: Modify src/index.css to scope preflight**

Replace `src/index.css` contents:

```css
/* Tailwind v4 — scoped preflight + utilities.
 *
 * Default `@import "tailwindcss"` would emit base-layer resets (preflight) at
 * global scope, smashing WP theme styling for h1/h2/button/a/etc. We import
 * theme + utilities normally, then manually re-implement preflight ONLY inside
 * #bracket-root and .bracket-generator-mount (multi-instance support).
 */
@layer theme, base, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

@layer base {
  #bracket-root,
  #bracket-root *,
  #bracket-root *::before,
  #bracket-root *::after,
  .bracket-generator-mount,
  .bracket-generator-mount *,
  .bracket-generator-mount *::before,
  .bracket-generator-mount *::after {
    box-sizing: border-box;
    border-width: 0;
    border-style: solid;
    border-color: currentColor;
  }

  #bracket-root,
  .bracket-generator-mount {
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    -moz-tab-size: 4;
    tab-size: 4;
    font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    font-feature-settings: normal;
    font-variation-settings: normal;
  }

  #bracket-root h1, #bracket-root h2, #bracket-root h3, #bracket-root h4, #bracket-root h5, #bracket-root h6,
  .bracket-generator-mount h1, .bracket-generator-mount h2, .bracket-generator-mount h3, .bracket-generator-mount h4, .bracket-generator-mount h5, .bracket-generator-mount h6 {
    font-size: inherit;
    font-weight: inherit;
    margin: 0;
  }

  #bracket-root p, #bracket-root blockquote, #bracket-root pre, #bracket-root figure,
  .bracket-generator-mount p, .bracket-generator-mount blockquote, .bracket-generator-mount pre, .bracket-generator-mount figure {
    margin: 0;
  }

  #bracket-root ol, #bracket-root ul, #bracket-root menu,
  .bracket-generator-mount ol, .bracket-generator-mount ul, .bracket-generator-mount menu {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  #bracket-root a,
  .bracket-generator-mount a {
    color: inherit;
    text-decoration: inherit;
  }

  #bracket-root button, #bracket-root input, #bracket-root optgroup, #bracket-root select, #bracket-root textarea,
  .bracket-generator-mount button, .bracket-generator-mount input, .bracket-generator-mount optgroup, .bracket-generator-mount select, .bracket-generator-mount textarea {
    font-family: inherit;
    font-feature-settings: inherit;
    font-variation-settings: inherit;
    font-size: 100%;
    font-weight: inherit;
    line-height: inherit;
    letter-spacing: inherit;
    color: inherit;
    margin: 0;
    padding: 0;
  }

  #bracket-root button, #bracket-root [type="button"], #bracket-root [type="reset"], #bracket-root [type="submit"],
  .bracket-generator-mount button, .bracket-generator-mount [type="button"], .bracket-generator-mount [type="reset"], .bracket-generator-mount [type="submit"] {
    background-color: transparent;
    background-image: none;
    cursor: pointer;
  }

  #bracket-root img, #bracket-root svg, #bracket-root video, #bracket-root canvas, #bracket-root audio, #bracket-root iframe, #bracket-root embed, #bracket-root object,
  .bracket-generator-mount img, .bracket-generator-mount svg, .bracket-generator-mount video, .bracket-generator-mount canvas, .bracket-generator-mount audio, .bracket-generator-mount iframe, .bracket-generator-mount embed, .bracket-generator-mount object {
    display: block;
    vertical-align: middle;
    max-width: 100%;
    height: auto;
  }
}

html, body, #bracket-root {
  height: 100%;
  margin: 0;
}

@page {
  size: letter landscape;
  margin: 1in;
}

@media print {
  html, body, #bracket-root, .bracket-generator-mount {
    background: white !important;
    color: black !important;
  }

  .bracket-container {
    background: white !important;
    color: black !important;
  }

  header, button, .no-print {
    display: none !important;
  }
}
```

- [ ] **Step 4: Verify dev mode renders correctly**

Run: `npm run dev`

Open `http://localhost:5173/bracket-generator/` and confirm the bracket UI looks right (Tailwind utilities applied, layout intact).

- [ ] **Step 5: Build, then verify the test page**

Run: `npm run build` (uses default vite.config — outputs to `dist/`)

To test isolation, open `scripts/wp-test-page.html` in a browser. Note that the script src in the HTML points at `../wp-plugin/bracket-generator/dist/bracket-generator.js` — that path won't exist until Task 3 + Task 7 are done. **For this task only**, temporarily change the script src to point at the dev `dist/` output's main file (e.g., `../dist/assets/index-XXXXX.js`).

Expected:
- The `<h1>` "Fake WP Theme Page" stays Georgia serif, blue (#2a5a8a), with the underline border
- `<a>` tags outside the bracket stay red (#c0392b) and underlined
- `<button>` outside stays blue with white text
- The bracket mount renders normally inside `#bracket-root`

If WP-side styling breaks: inspect the offending element in devtools. Check whether a Tailwind utility is applied globally (specificity issue). Possible fix: wrap selectors in `:where(...)` to lower specificity, OR add explicit "outside the bracket" rules that re-assert WP styling.

Revert the test page's script src after this verification.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/main.jsx index.html scripts/wp-test-page.html
git commit -m "feat(css): scope Tailwind v4 preflight to #bracket-root for WP isolation"
```

---

## Task 3: Mode-based Vite config (dev + plugin)

**Why:** Dev mode needs `base: '/bracket-generator/'` for HMR routing and multi-chunk output for fast HMR. Plugin mode needs `base: './'` (relative paths so the bundle works at any URL Stuart's WP serves it from), single-bundle output (avoids the multi-file enqueue problem in WP), and output into `wp-plugin/bracket-generator/dist/`.

**Files:**
- Modify: `vite.config.js`
- Modify: `package.json` (add `build:plugin` script)
- Modify: `.gitignore` (ignore plugin build artifacts)

- [ ] **Step 1: Refactor vite.config.js to mode-based**

Replace `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isPlugin = mode === 'plugin';

  return {
    base: isPlugin ? './' : '/bracket-generator/',
    plugins: [react(), tailwindcss()],
    build: isPlugin
      ? {
          outDir: 'wp-plugin/bracket-generator/dist',
          emptyOutDir: true,
          rollupOptions: {
            output: {
              manualChunks: undefined,
              entryFileNames: 'bracket-generator.js',
              chunkFileNames: 'bracket-generator-[name].js',
              assetFileNames: 'bracket-generator.[ext]',
            },
          },
        }
      : undefined,
  };
});
```

- [ ] **Step 2: Add build:plugin script**

Modify `package.json` scripts block:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:plugin": "vite build --mode plugin",
  "lint": "eslint .",
  "preview": "vite preview",
  "verify": "node scripts/verify-brackets.js",
  "capture:brand": "node scripts/capture-interbasket-brand.js"
}
```

- [ ] **Step 3: Update .gitignore for plugin build output**

Append to `.gitignore`:

```
# WP plugin build output (regenerated by `npm run build:plugin`)
wp-plugin/bracket-generator/dist/

# Plugin distribution zip (regenerated by build pipeline)
*.zip
```

- [ ] **Step 4: Verify both build modes work**

Run: `npm run build`

Expected: `dist/` directory created with hashed filenames (e.g., `dist/assets/index-XXXXXX.js`).

Run: `npm run build:plugin`

Expected: `wp-plugin/bracket-generator/dist/` directory created with `bracket-generator.js` and `bracket-generator.css` (no hashes, single file).

Run: `npm run dev`

Expected: dev server starts, bracket renders at `http://localhost:5173/bracket-generator/`.

- [ ] **Step 5: Commit**

```bash
git add vite.config.js package.json .gitignore
git commit -m "feat(build): add plugin-mode Vite config with single-bundle output"
```

---

## Task 4: Refactor JS mount for plugin compatibility

**Why:** The plugin's PHP shortcode emits `<div id="bracket-root-1" class="bracket-generator-mount" data-theme="interbasket">`. The JS bundle must mount React into THAT div, not a hardcoded `#bracket-root`. We expose `window.BracketGenerator.mount(container, options)` for the plugin to call after the DOM is ready, while keeping a dev auto-mount fallback so `npm run dev` still works.

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/App.jsx` (accept `initialTheme` and `feedbackUrl` props)

- [ ] **Step 1: Refactor src/main.jsx**

Replace `src/main.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

/**
 * Mount the bracket generator into a given container.
 *
 * @param {HTMLElement} container - The DOM element to mount into.
 * @param {Object} [options] - Optional overrides.
 * @param {string} [options.theme] - Theme name. Falls back to container.dataset.theme.
 * @param {string} [options.feedbackUrl] - Feedback link URL. Falls back to container.dataset.feedbackUrl.
 * @returns {import('react-dom/client').Root} The React root, in case the caller needs to unmount later.
 */
export function mount(container, options = {}) {
  if (!container) {
    throw new Error('BracketGenerator.mount: container is required');
  }
  const theme = options.theme || container.dataset.theme || 'bw';
  const feedbackUrl =
    options.feedbackUrl ||
    container.dataset.feedbackUrl ||
    'mailto:interbasketmedia@gmail.com?subject=Bracket%20Generator%20problem';

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App initialTheme={theme} feedbackUrl={feedbackUrl} />
    </React.StrictMode>
  );
  return root;
}

// Expose globally for the WP plugin's inline script to call.
if (typeof window !== 'undefined') {
  window.BracketGenerator = { mount };
}

// Dev auto-mount: if a #bracket-root exists on page load and isn't already
// mounted, mount automatically. Keeps `npm run dev` working without changes.
if (typeof document !== 'undefined') {
  const auto = () => {
    const devContainer = document.getElementById('bracket-root');
    if (devContainer && !devContainer.dataset.mounted) {
      devContainer.dataset.mounted = '1';
      mount(devContainer);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', auto);
  } else {
    auto();
  }
}
```

- [ ] **Step 2: Refactor src/App.jsx to accept new props**

Modify `src/App.jsx` line 19. Current:

```jsx
export default function App() {
  const [title, setTitle] = useState('Tournament Bracket');
  const [themeName, setThemeName] = useState('bw');
```

Replace with:

```jsx
export default function App({ initialTheme = 'bw', feedbackUrl = null }) {
  const [title, setTitle] = useState('Tournament Bracket');
  const [themeName, setThemeName] = useState(initialTheme);
```

(The `feedbackUrl` prop is consumed in Task 5; declare it now so Task 5 only modifies render.)

- [ ] **Step 3: Verify dev mode still works**

Run: `npm run dev`

Open `http://localhost:5173/bracket-generator/` — the bracket should render exactly as before (theme `bw`, default state). The dev container has `id="bracket-root"`; auto-mount fires.

- [ ] **Step 4: Build the plugin bundle and verify the global is exposed**

Run: `npm run build:plugin`

Inspect the built bundle (search for `BracketGenerator`):

```bash
grep -c "BracketGenerator" wp-plugin/bracket-generator/dist/bracket-generator.js
```

Expected: at least 1 match (the global assignment).

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx src/App.jsx
git commit -m "feat(react): expose window.BracketGenerator.mount for plugin embedding"
```

---

## Task 5: Add feedback mailto link to UI footer

**Why:** Stuart wants users to report issues via `mailto:interbasketmedia@gmail.com?subject=Bracket Generator problem`. Surface it as a small footer link visible on both setup and generated views. Drive it from the `feedbackUrl` prop set in Task 4 so a different theme could override the email if needed later (low cost, future-proofing).

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the footer to App.jsx render**

Modify `src/App.jsx`. Find the closing `</div>` of the outermost return wrapper (around line 162). Insert a `<footer>` before it.

Replace lines from the closing `</>)}` block through the final `</div>` with:

```jsx
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  data-testid="back-to-setup"
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  style={{
                    background: theme.cardBg,
                    border: `1px solid ${theme.cardBorder}`,
                    color: theme.text,
                  }}
                >
                  Back to Setup
                </button>
                <ThemePicker themeName={themeName} setThemeName={setThemeName} currentTheme={theme} />
                <button
                  onClick={() => setShowSeeds(!showSeeds)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  style={{
                    background: showSeeds ? theme.accent + '22' : theme.cardBg,
                    border: `1px solid ${showSeeds ? theme.accent : theme.cardBorder}`,
                    color: showSeeds ? theme.accent : theme.text,
                  }}
                >
                  {showSeeds ? 'Seeded' : 'Unseeded'}
                </button>
              </div>
              <ExportButtons bracketRef={bracketRef} title={title} theme={theme} printMargin={printMargin} />
            </div>

            <div ref={bracketRef}>
              <BracketView
                bracket={bracket}
                doubleBracket={doubleBracket}
                bracketType={bracketType}
                bracketStyle={bracketStyle}
                layout={layout}
                theme={theme}
                title={title}
                onAdvanceWinner={handleAdvanceWinner}
                showSeeds={showSeeds}
              />
            </div>
          </>
        )}
      </div>

      {feedbackUrl && (
        <footer
          className="no-print text-center py-4 text-sm"
          style={{ color: theme.textMuted, borderTop: `1px solid ${theme.cardBorder}` }}
        >
          <a
            href={feedbackUrl}
            style={{ color: theme.accent, textDecoration: 'underline' }}
          >
            Provide feedback
          </a>
        </footer>
      )}
    </div>
  );
}
```

The `no-print` class hides the footer in PNG/PDF exports (already wired up via `src/index.css`'s `@media print` rule).

- [ ] **Step 2: Verify in dev mode**

Run: `npm run dev` (if not already running)

Open `http://localhost:5173/bracket-generator/`. The default `feedbackUrl` is set by `main.jsx` (the mailto). Verify:
- A "Provide feedback" link appears below the bracket UI
- Theme accent color applied
- Top border separator visible
- Click opens the user's mail client with `interbasketmedia@gmail.com` pre-filled and "Bracket Generator problem" as subject

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(ui): add feedback mailto link in footer (theme-driven, hidden on print)"
```

---

## Task 6: Add `printerfriend` and `interbasket` theme variants

**Why:** Stuart wants each site's embedded tool to feel native to its host site's brand. Task 1 captured interbasket's tokens; printerfriend's are verified via the earlier search-specialist recon. Add both to the `THEMES` object.

**Files:**
- Modify: `src/utils/themes.js`

- [ ] **Step 1: Add the two theme entries**

Modify `src/utils/themes.js`. After the existing `sakura` entry (line 121), and BEFORE the closing `};`, insert:

```js
  printerfriend: {
    name: 'Printerfriend',
    bg: '#ffffff',
    cardBg: '#f7f7f7',
    cardBorder: '#52C0D4',
    accent: '#EF4423',
    text: '#555555',
    textMuted: '#999999',
    winnerBg: '#52C0D4',
    winnerText: '#ffffff',
    roundLabel: '#52C0D4',
    connector: '#555555',
    headerBg: '#EF4423',
    preview: ['#ffffff', '#f7f7f7', '#52C0D4', '#EF4423'],
  },
  interbasket: {
    name: 'Interbasket',
    // INSTRUCTION: replace the values below with the captured tokens from
    // PACKAGING.md "interbasket.net" brand-recon section (populated by Task 1).
    // The starting palette below is a basketball-themed default (orange + navy)
    // that's safe if Task 1's capture is missing a token.
    bg: '#ffffff',
    cardBg: '#f5f5f5',
    cardBorder: '#1d3557',
    accent: '#e76f51',
    text: '#1d3557',
    textMuted: '#5a6378',
    winnerBg: '#e76f51',
    winnerText: '#ffffff',
    roundLabel: '#1d3557',
    connector: '#1d3557',
    headerBg: '#1d3557',
    preview: ['#ffffff', '#f5f5f5', '#e76f51', '#1d3557'],
  },
```

- [ ] **Step 2: Reconcile with Task 1 capture**

Open `PACKAGING.md` and find the "interbasket.net" brand-recon table (populated by Task 1). For each token in the `interbasket` theme entry above, compare with the captured value:

- If captured matches: leave the default
- If captured differs: replace with the captured value

This concrete reconciliation step is why Task 1 runs before Task 6.

- [ ] **Step 3: Verify both themes render correctly in dev**

Run: `npm run dev`

Temporarily change `App.jsx`'s `initialTheme` default from `'bw'` to `'printerfriend'`, refresh.

Expected: predominantly orange-red (`#EF4423`) and teal (`#52C0D4`), light backgrounds, clean utilitarian feel.

Change again to `'interbasket'`, refresh.

Expected: navy + orange palette per the entries above (refined against Task 1 capture if applicable).

Revert `App.jsx`'s `initialTheme` default to `'bw'` after verification.

- [ ] **Step 4: Commit**

```bash
git add src/utils/themes.js
git commit -m "feat(themes): add printerfriend and interbasket brand-matched themes"
```

---

## Task 7: WP plugin PHP scaffold

**Why:** The PHP plugin is the integration entry point. It registers the `[bracket-generator]` shortcode, generates a unique mount div per instance, enqueues the JS/CSS bundle once per page, and emits an inline mount script that calls `window.BracketGenerator.mount()` once the global is available.

**Files:**
- Create: `wp-plugin/bracket-generator/bracket-generator.php`

- [ ] **Step 1: Create the plugin file**

Create `wp-plugin/bracket-generator/bracket-generator.php`:

```php
<?php
/**
 * Plugin Name: Bracket Generator
 * Plugin URI: https://github.com/aliceopenclaw8/bracket-generator
 * Description: Embed an interactive tournament bracket generator on any page via the [bracket-generator] shortcode. Supports brand-matched theme variants and optional ad slots.
 * Version: 1.0.0
 * Author: Swee Wai Hoow
 * License: MIT
 * Text Domain: bracket-generator
 * Requires PHP: 7.4
 * Requires at least: 5.5
 */

// Block direct access — required by WP plugin standards
if (!defined('ABSPATH')) {
    exit;
}

class Bracket_Generator_Plugin {
    /** @var int Counter for unique mount IDs across multiple shortcodes per page */
    private static $instance_count = 0;

    /** @var bool Track whether assets have been enqueued (only once per page) */
    private static $assets_enqueued = false;

    public function __construct() {
        add_shortcode('bracket-generator', [$this, 'render_shortcode']);
        // Vite emits ES modules — WP doesn't enqueue with type="module" by default
        add_filter('script_loader_tag', [$this, 'add_module_type'], 10, 2);
    }

    /**
     * Render the [bracket-generator theme="..." ads="top,bottom"] shortcode.
     */
    public function render_shortcode($atts) {
        $atts = shortcode_atts(
            [
                'theme' => 'bw',
                'ads'   => '', // comma-separated; valid values: 'top', 'bottom'
            ],
            $atts,
            'bracket-generator'
        );

        self::$instance_count++;
        $instance_id = 'bracket-root-' . self::$instance_count;

        if (!self::$assets_enqueued) {
            $this->enqueue_assets();
            self::$assets_enqueued = true;
        }

        $ad_positions = array_map('trim', explode(',', $atts['ads']));
        $show_top    = in_array('top', $ad_positions, true);
        $show_bottom = in_array('bottom', $ad_positions, true);

        ob_start();
        ?>
        <div class="bracket-generator-wrapper">
            <?php if ($show_top): ?>
                <div class="bracket-ad bracket-ad-top">
                    <?php echo do_shortcode('[gard]'); ?>
                </div>
            <?php endif; ?>

            <div id="<?php echo esc_attr($instance_id); ?>"
                 class="bracket-generator-mount"
                 data-theme="<?php echo esc_attr($atts['theme']); ?>"></div>

            <?php if ($show_bottom): ?>
                <div class="bracket-ad bracket-ad-bottom">
                    <?php echo do_shortcode('[gard]'); ?>
                </div>
            <?php endif; ?>
        </div>
        <script>
            (function() {
                var id = <?php echo wp_json_encode($instance_id); ?>;
                var attempts = 0;
                function tryMount() {
                    if (window.BracketGenerator && typeof window.BracketGenerator.mount === 'function') {
                        var el = document.getElementById(id);
                        if (el && !el.dataset.mounted) {
                            el.dataset.mounted = '1';
                            window.BracketGenerator.mount(el);
                        }
                        return;
                    }
                    if (++attempts > 100) {
                        console.error('BracketGenerator failed to load after 5s');
                        return;
                    }
                    setTimeout(tryMount, 50);
                }
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', tryMount);
                } else {
                    tryMount();
                }
            })();
        </script>
        <?php
        return ob_get_clean();
    }

    /**
     * Enqueue the bundle's JS and CSS exactly once per page.
     */
    private function enqueue_assets() {
        $plugin_url = plugin_dir_url(__FILE__);

        wp_enqueue_script(
            'bracket-generator',
            $plugin_url . 'dist/bracket-generator.js',
            [],
            '1.0.0',
            true // load in footer
        );

        wp_enqueue_style(
            'bracket-generator',
            $plugin_url . 'dist/bracket-generator.css',
            [],
            '1.0.0'
        );
    }

    /**
     * Vite outputs ES modules. WP's wp_enqueue_script doesn't add type="module"
     * by default — we filter the script tag for our handle.
     */
    public function add_module_type($tag, $handle) {
        if ($handle === 'bracket-generator') {
            return str_replace(' src=', ' type="module" src=', $tag);
        }
        return $tag;
    }
}

new Bracket_Generator_Plugin();
```

- [ ] **Step 2: Build the plugin bundle**

Run: `npm run build:plugin`

Expected: `wp-plugin/bracket-generator/dist/bracket-generator.js` and `bracket-generator.css` exist.

- [ ] **Step 3: Sanity-check PHP syntax (if PHP available)**

If PHP is installed locally:

```bash
php -l wp-plugin/bracket-generator/bracket-generator.php
```

Expected: `No syntax errors detected`

If PHP is not installed locally: skip — the real test is installing on Stuart's WP (Task 10). Note that runtime PHP errors won't surface until then.

- [ ] **Step 4: Commit**

```bash
git add wp-plugin/bracket-generator/bracket-generator.php
git commit -m "feat(wp-plugin): add PHP shortcode plugin with mount + ad slots + multi-instance"
```

---

## Task 8: Build pipeline (build:plugin:zip → bracket-generator.zip)

**Why:** Stuart installs the plugin via WP admin → Plugins → Add New → Upload Plugin → upload .zip. We need a single command (`npm run build:plugin:zip`) that produces `bracket-generator.zip` ready for upload.

**Files:**
- Create: `scripts/build-plugin.js`
- Modify: `package.json` (add `archiver` dep, add `build:plugin:zip` script)

- [ ] **Step 1: Install archiver as a dev dependency**

Run:

```bash
npm install --save-dev archiver
```

Expected: `archiver` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Write the build pipeline script**

Create `scripts/build-plugin.js`. Note: this script uses Vite's programmatic build API (`import { build } from 'vite'`) instead of spawning a subprocess, avoiding shell-injection risk.

```js
/**
 * Build the WP plugin: invoke Vite plugin-mode build, then zip the plugin folder.
 * Output: bracket-generator.zip at repo root.
 */
import { build as viteBuild } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

const PLUGIN_DIR = 'wp-plugin/bracket-generator';
const ZIP_PATH = 'bracket-generator.zip';

console.log('[1/3] Running Vite plugin build...');
await viteBuild({ mode: 'plugin' });

const distDir = path.join(PLUGIN_DIR, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('Build output not found at', distDir);
  process.exit(1);
}

const requiredFiles = [
  path.join(PLUGIN_DIR, 'bracket-generator.php'),
  path.join(PLUGIN_DIR, 'dist', 'bracket-generator.js'),
  path.join(PLUGIN_DIR, 'dist', 'bracket-generator.css'),
];
for (const f of requiredFiles) {
  if (!fs.existsSync(f)) {
    console.error('Missing required file:', f);
    process.exit(1);
  }
}

console.log('[2/3] Cleaning previous zip...');
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}

console.log('[3/3] Creating', ZIP_PATH, '...');
await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(ZIP_PATH);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    const sizeKb = (archive.pointer() / 1024).toFixed(1);
    console.log(`  ${ZIP_PATH} created (${sizeKb} KB)`);
    resolve();
  });
  archive.on('error', reject);

  archive.pipe(output);
  // The zip's top-level folder must be 'bracket-generator/' so WP plugin uploader
  // extracts it correctly. archiver's `directory(src, destInZip)` handles this.
  archive.directory(PLUGIN_DIR, 'bracket-generator');
  archive.finalize();
});

console.log('Done. Upload', ZIP_PATH, 'via WP admin → Plugins → Add New → Upload Plugin.');
```

- [ ] **Step 3: Add the npm script**

Modify `package.json` scripts:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:plugin": "vite build --mode plugin",
  "build:plugin:zip": "node scripts/build-plugin.js",
  "lint": "eslint .",
  "preview": "vite preview",
  "verify": "node scripts/verify-brackets.js",
  "capture:brand": "node scripts/capture-interbasket-brand.js"
}
```

- [ ] **Step 4: Run the build pipeline**

Run: `npm run build:plugin:zip`

Expected output:
```
[1/3] Running Vite plugin build...
... vite output ...
[2/3] Cleaning previous zip...
[3/3] Creating bracket-generator.zip ...
  bracket-generator.zip created (NNN KB)
Done. Upload bracket-generator.zip via WP admin → Plugins → Add New → Upload Plugin.
```

Verify: `bracket-generator.zip` exists at repo root.

- [ ] **Step 5: Inspect the zip contents**

Run:

```bash
unzip -l bracket-generator.zip
```

Expected entries:
```
bracket-generator/
bracket-generator/bracket-generator.php
bracket-generator/dist/
bracket-generator/dist/bracket-generator.js
bracket-generator/dist/bracket-generator.css
```

If `bracket-generator/INSTALL.md` exists from Task 11, it should also be listed (Task 11 ships independently of this).

- [ ] **Step 6: Commit**

```bash
git add scripts/build-plugin.js package.json package-lock.json
git commit -m "feat(build): plugin zip pipeline (build:plugin:zip → bracket-generator.zip)"
```

---

## Task 9: Multi-instance verification

**Why:** Stuart could place two `[bracket-generator]` shortcodes on one page (e.g., one above an article, one below). Each must mount independently with unique IDs and not interfere. The plugin's `instance_count` counter handles uniqueness; this task verifies it works end-to-end.

**Files:**
- Modify: `scripts/wp-test-page.html` (add a second mount and a simulated second shortcode)

- [ ] **Step 1: Add a second mount to the test page**

Modify `scripts/wp-test-page.html`. Replace the single `<div id="bracket-root">` with two mount points simulating what the plugin emits:

```html
  <div class="bracket-generator-wrapper">
    <div id="bracket-root-1" class="bracket-generator-mount" data-theme="printerfriend"></div>
  </div>

  <h2>Some content between brackets</h2>
  <p>This text should retain WP-theme styling.</p>

  <div class="bracket-generator-wrapper">
    <div id="bracket-root-2" class="bracket-generator-mount" data-theme="interbasket"></div>
  </div>

  <script type="module" src="../wp-plugin/bracket-generator/dist/bracket-generator.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      function attempt(retries) {
        if (window.BracketGenerator) {
          window.BracketGenerator.mount(document.getElementById('bracket-root-1'));
          window.BracketGenerator.mount(document.getElementById('bracket-root-2'));
          return;
        }
        if (retries > 0) setTimeout(() => attempt(retries - 1), 50);
      }
      attempt(100);
    });
  </script>
```

Note: `src/main.jsx`'s auto-mount logic looks for `#bracket-root` (singular). With two mount divs (`bracket-root-1` and `bracket-root-2`), the auto-mount won't fire — manual mounting via the script above is what we're testing.

- [ ] **Step 2: Rebuild and load the test page**

Run: `npm run build:plugin`

Open `scripts/wp-test-page.html` in a browser.

Expected:
- Both bracket mounts render
- The first uses the printerfriend theme (orange-red + teal)
- The second uses the interbasket theme (navy + orange)
- WP-styled `<h1>`, `<h2>`, `<a>`, `<button>` elements OUTSIDE the bracket wrappers retain their styling

If only one mounts: open browser devtools, check for "container is required" or React errors. Likely a timing issue — increase the retry count.

- [ ] **Step 3: Commit**

```bash
git add scripts/wp-test-page.html
git commit -m "test: verify multi-instance mounting + isolation"
```

---

## Task 10: Real-site install test (manual)

**Why:** A clean WP-install + Tailwind-isolation test page is necessary but not sufficient. Stuart's actual sites have his actual theme + Yoast + AdSense + miscellaneous plugins. Real install is the only way to catch real conflicts.

**Files:**
- Modify: `PACKAGING.md` (append observations from real install)

This is a manual task. Use credentials from `.env.local`. The Puppeteer-driven version is overkill for a one-off.

- [ ] **Step 1: Install on printerfriend.ly first (lower-risk site)**

1. Open browser, go to `https://printerfriend.ly/wp-admin/`
2. Log in with `wai` / password from `.env.local` (`PRINTERFRIEND_WP_PASS`)
3. Plugins → Add New → Upload Plugin → choose `bracket-generator.zip` → Install Now
4. Activate plugin
5. Pages → Add New → title "Bracket Test" → in the editor, paste:
   ```
   Test page intro paragraph.

   [bracket-generator theme="printerfriend"]

   Test page outro paragraph.
   ```
6. Publish, view the page

Expected:
- Page intro/outro render with normal site styling
- Bracket renders inline between them with printerfriend palette
- No JS errors in browser devtools console
- The page's other elements (header, sidebar, footer) look normal

- [ ] **Step 2: Test ad slots on printerfriend.ly**

Edit the test page. Change shortcode to:

```
[bracket-generator theme="printerfriend" ads="top,bottom"]
```

Update + view.

Expected:
- Ad slot containers appear above and below the bracket
- If Stuart's `[gard]` plugin is active and configured, AdSense placeholder/ads render in those slots
- If `[gard]` is NOT yet configured, the slots will be empty (visible empty divs) — that's expected and confirms our shortcode-passthrough works

- [ ] **Step 3: Repeat install on interbasket.net**

Same steps as Step 1 but using interbasket credentials and `theme="interbasket"`.

Expected: same behavior. Note any styling differences (Yoast schema badges in the editor, etc.) that might affect the install README.

- [ ] **Step 4: Document observations in PACKAGING.md**

Append a new section to `PACKAGING.md`:

```markdown
## Real-site install verification (Task 10)

**Tested on:** YYYY-MM-DD
**printerfriend.ly:**
- Install: success / issues
- Theme variant render: pass / fail with notes
- Ad slot expansion ([gard]): worked / didn't / not configured
- Console errors: list any
- Theme conflicts (Yoast/MesoColumn elements styled correctly outside bracket): pass / fail

**interbasket.net:**
- Install: success / issues
- Theme variant render: pass / fail with notes
- Ad slot expansion ([gard]): worked / didn't / not configured
- Console errors: list any
- Theme conflicts: pass / fail
```

Fill in the actual results.

- [ ] **Step 5: Commit**

```bash
git add PACKAGING.md
git commit -m "docs: record real-site install verification on both client sites"
```

---

## Task 11: Install README for Stuart

**Why:** Stuart will install + configure the plugin himself eventually (and on future pages). A clear README that walks through install, page setup, SEO copy placement, schema configuration, and ad placement reduces back-and-forth.

**Files:**
- Create: `wp-plugin/bracket-generator/INSTALL.md`

- [ ] **Step 1: Write the README**

Create `wp-plugin/bracket-generator/INSTALL.md`:

```markdown
# Bracket Generator — Installation & Setup

Quick start for installing and using the bracket generator plugin on your WordPress site.

## 1. Install the plugin

1. In your WP admin, go to **Plugins → Add New → Upload Plugin**.
2. Click **Choose File** and select `bracket-generator.zip`.
3. Click **Install Now**, then **Activate Plugin**.

That's it for installation. The plugin is now available on your site.

## 2. Create your bracket-generator page

1. **Pages → Add New**.
2. Set the title to "Bracket Generator" (or similar) and set the URL slug to `bracket-generator` so the page lives at:
   - `https://www.interbasket.net/bracket-generator/` (interbasket)
   - `https://printerfriend.ly/bracket-generator/` (printerfriendly)

   This is the slug you confirmed — root-level path, consistent across both sites, and it leaves you room to expand into child pages like `/bracket-generator/16-team-single-elimination/` later for your multi-page SEO strategy.

3. In the editor, paste your SEO copy (the H1, intro paragraphs, "How to" steps, FAQ — all the copy from your Google Doc).
4. Where you want the bracket tool to appear, drop the shortcode:
   ```
   [bracket-generator theme="interbasket"]
   ```
   (Use `theme="printerfriend"` on printerfriend.ly.)

5. Publish.

## 3. Available shortcode options

```
[bracket-generator theme="..." ads="..."]
```

| Attribute | Values | Default | Notes |
|-----------|--------|---------|-------|
| `theme` | `interbasket`, `printerfriend`, `bw`, `classic`, `emerald`, `sunset`, `arctic`, `volcano`, `midnight`, `sakura` | `bw` | Brand-matched themes for your sites are `interbasket` and `printerfriend`. Others are general palettes. |
| `ads` | comma-separated `top`, `bottom` | empty | If set, renders an ad slot above/below the bracket using your existing `[gard]` shortcode. Omit to place ads anywhere on the page yourself with a separate `[gard]`. |

Examples:

- `[bracket-generator theme="interbasket"]` — bracket only, no ad slots
- `[bracket-generator theme="interbasket" ads="top"]` — ad above the bracket
- `[bracket-generator theme="printerfriend" ads="top,bottom"]` — ads above and below

## 4. SEO setup with Yoast

After publishing the page:

1. Open the page in WP admin → scroll to the **Yoast SEO** sidebar.
2. **SEO title:** suggested template `Free Bracket Generator | Create & Print Tournament Brackets`
3. **Meta description:** suggested `Create tournament brackets instantly. Free, customizable, and printable bracket generator for single elimination, round robin, and more.`
4. **Schema → Page type:** set to `WebPage`. **Article type:** set to `None` (this is a tool page, not an article).
5. **Schema → Custom fields:** if your Yoast tier supports custom blocks/fields, add `FAQPage` schema using the FAQ section of your copy. Free Yoast users can use a separate FAQ block plugin or manual JSON-LD via Yoast's "Schema → Custom" field.

Stuart-specific note: your SEO copy doc lists FAQ + SoftwareApplication schema as recommended. SoftwareApplication schema can be added via Yoast's "Schema → Custom" field with JSON-LD; ask if you want me to draft it.

## 5. Multi-page strategy

You can place the shortcode on as many pages as you want — each with different SEO copy targeting different keywords (e.g., `/bracket-generator/16-team/`, `/bracket-generator/basketball/`, etc.).

The shortcode is identical across pages; only the surrounding WP page copy changes. Each page Google indexes independently based on its unique copy.

## 6. Updating the plugin

When a new version ships:
1. **Plugins → Installed Plugins → Bracket Generator → Deactivate**
2. **Delete** the old version (your settings persist; the plugin doesn't store data in the DB)
3. Repeat step 1 from this guide with the new `bracket-generator.zip`

## Troubleshooting

**The bracket doesn't appear on the page**
- Check browser devtools console for JS errors
- Confirm the plugin is activated (Plugins → Installed Plugins)
- Try a different theme to rule out theme caching: `[bracket-generator theme="bw"]` should always render

**My theme's headings/buttons look broken on the bracket page**
- This means CSS isolation didn't fully work for your theme. Open an issue and share the page URL — we'll add specific scoping for your theme.

**Ad slots are empty**
- Verify your AdSense plugin uses the shortcode `[gard]` (not `[ad]` or another name). If different, contact us — the plugin needs a one-line PHP change.
- Verify the AdSense plugin is active and has at least one ad unit configured.

**The bracket appears but looks unstyled**
- The plugin's CSS file may not have loaded. Check browser devtools → Network tab for `bracket-generator.css` and confirm it returned 200 OK.
```

- [ ] **Step 2: Verify the README is included in the build zip**

Run: `npm run build:plugin:zip`

Run: `unzip -l bracket-generator.zip | grep INSTALL`

Expected: `bracket-generator/INSTALL.md` is listed.

- [ ] **Step 3: Commit**

```bash
git add wp-plugin/bracket-generator/INSTALL.md
git commit -m "docs(wp-plugin): install and setup README for client"
```

---

## Task 12: Wrap up — verify clean state and final smoke test

**Why:** Final pass before handing the zip to Stuart. Verify no stray uncommitted changes, the build pipeline runs clean from scratch, and the test page works end-to-end.

- [ ] **Step 1: Clean working tree check**

Run: `git status`

Expected: nothing to commit, working tree clean.

If anything is uncommitted: investigate, commit or revert.

- [ ] **Step 2: Clean rebuild**

Run:

```bash
rm -rf wp-plugin/bracket-generator/dist bracket-generator.zip
npm run build:plugin:zip
```

Expected: clean rebuild succeeds, zip is regenerated.

- [ ] **Step 3: End-to-end smoke test on the test page**

Open `scripts/wp-test-page.html` in a browser.

Verify:
- Both bracket mounts render with their respective themes
- WP-theme-styled elements OUTSIDE the bracket retain their styling
- No console errors

- [ ] **Step 4: Final commit and tag**

```bash
git tag -a v1.0.0-wp-plugin -m "First installable WP plugin build"
```

(Optionally push the tag if Swee approves: `git push origin v1.0.0-wp-plugin`)

---

## Spec coverage check

Mapping each PACKAGING.md "v1 must-have" to a task:

| PACKAGING must-have | Task |
|---|---|
| WP shortcode plugin: `[bracket-generator theme="..." ads="..."]` | Task 7, 8 |
| Two brand-matched theme variants (`interbasket`, `printerfriend`) | Task 1, 6 |
| Feedback mailto link in tool footer | Task 4, 5 |
| Optional ad slots wrapping `[gard]` | Task 7 (rendered), Task 10 (verified) |
| Tailwind preflight isolation scoped to `#bracket-root` | Task 2 (extended to `.bracket-generator-mount` in same task) |
| Multi-instance safety (unique mount IDs) | Task 7 (counter), Task 9 (verified) |
| Build pipeline → `bracket-generator.zip` | Task 8 |
| Install README for Stuart | Task 11 |

All v1 must-haves are covered. Deferred items (presets, programmatic SEO, plugin update server) are explicitly out of scope per PACKAGING.md and not in this plan.

## Open questions surfaced during planning

1. **AdSense `[gard]` plugin identity unverified** — Task 7 calls `do_shortcode('[gard]')` assuming the shortcode resolves on Stuart's sites. Task 10 (real install) is the empirical verification. If `[gard]` doesn't expand for our wrapper, escalation: have Stuart confirm the plugin name; possibly switch to a different shortcode if his AdSense plugin uses a different name.
2. **Tailwind preflight scoping verified only against a synthetic test page** — Task 10's real-site install is the true compatibility test. If Stuart's MesoColumn theme (printerfriend) or interbasket's theme conflicts despite our scoping, the fallback is to add Shadow DOM isolation (~6h additional work).
3. **Yoast Premium vs Free for FAQ + SoftwareApplication schema** — Free Yoast supports basic schema; full FAQ schema may need Yoast Premium or a separate FAQ block plugin. Surface this to Stuart in the install README only if it materializes as a real friction point.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-27-wordpress-shortcode-plugin.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because Tasks 1, 2, and 7 each have meaningful complexity that benefits from a focused subagent context.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Faster turnaround per task but burns main session context.

**Which approach?**
