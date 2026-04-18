/**
 * Puppeteer verification for bracket generator.
 *
 * For each (count × type) scenario, this script:
 *   1. Loads the dev server.
 *   2. Configures bracket via UI (preset button or custom count input).
 *   3. Selects single/double elimination.
 *   4. Clicks Generate.
 *   5. Measures .bracket-container, .bracket-export-header content.
 *   6. Asserts Letter landscape aspect ratio (~1.294).
 *   7. Asserts (header + bracket content) fills container within ±8px.
 *   8. Asserts no descendant overflows the container bounds.
 *   9. Saves a screenshot.
 *
 * Exit code 0 on full pass, 1 on any failure.
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const REPORT_PATH = path.join(__dirname, 'verify-report.json');

// URL parses from env or defaults to common Vite port. vite.config.js sets base=/bracket-generator/
const BASE_URL = process.env.VERIFY_URL || 'http://localhost:5173/bracket-generator/';

// Scenarios: 6 counts × 2 types = 12 total.
const COUNTS = [4, 8, 16, 32, 64, 128];
const TYPES = ['single', 'double'];

// Letter landscape aspect = 11/8.5 = 1.2941.
const EXPECTED_ASPECT = 11 / 8.5;
const ASPECT_TOLERANCE = 0.005; // ±0.5% — bracket-container has CSS aspectRatio: '11/8.5', drift beyond 0.5% indicates a real bug.
const FILL_TOLERANCE_PX = 8; // ±8px tolerance — a hair looser than 5px to absorb sub-pixel aliasing.

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function waitForSelector(page, selector, timeout = 10_000) {
  await page.waitForSelector(selector, { timeout });
}

/**
 * Configure bracket via UI.
 * - count in [4,8,16,32] → preset button
 * - count > 32 → custom-count input + Set
 */
async function configureBracket(page, count, type) {
  // Select bracket type
  await waitForSelector(page, `[data-testid="bracket-type-${type}"]`);
  await page.click(`[data-testid="bracket-type-${type}"]`);

  // Set participant count
  const presetCounts = [4, 8, 16, 32];
  if (presetCounts.includes(count)) {
    await page.click(`[data-testid="preset-${count}"]`);
  } else {
    // Custom count — clear first, then type
    const input = await page.$('[data-testid="custom-count-input"]');
    await input.click({ clickCount: 3 });
    await input.press('Backspace');
    await input.type(String(count));
    await page.click('[data-testid="custom-count-set"]');
  }

  // Short wait for React state updates before clicking Generate
  await new Promise(r => setTimeout(r, 150));
  await page.click('[data-testid="generate-bracket"]');
  // Wait for the bracket container to appear
  await waitForSelector(page, '.bracket-container', 15_000);
  // Allow AutoScaleWrapper ResizeObserver to settle
  await new Promise(r => setTimeout(r, 600));
}

/**
 * Measure the bracket container & its inner layout.
 * Returns bounding rects + overflow diagnostics.
 */
async function measureBracket(page) {
  return await page.evaluate(() => {
    const container = document.querySelector('.bracket-container');
    if (!container) return { error: 'no .bracket-container' };
    const header = container.querySelector('.bracket-export-header');
    const innerWrapper = container.children[1]; // the padded flex-1 div that wraps AutoScaleWrapper
    const cRect = container.getBoundingClientRect();
    const hRect = header ? header.getBoundingClientRect() : null;
    const wRect = innerWrapper ? innerWrapper.getBoundingClientRect() : null;
    // innerWrapperClient measures the inside-padding rectangle — that's what AutoScaleWrapper
    // measures as availW/availH via clientWidth/Height. The bracket content must fit inside this.
    let wClient = null;
    if (innerWrapper) {
      // Derive the content box (inside padding) from computed style since clientLeft/clientTop
      // don't account for horizontal/vertical padding offsets directly for absolute coords.
      const cs = window.getComputedStyle(innerWrapper);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      wClient = {
        left: wRect.left + pl, top: wRect.top + pt,
        right: wRect.right - pr, bottom: wRect.bottom - pb,
        padLeft: pl, padRight: pr, padTop: pt, padBottom: pb,
      };
    }

    // For "fill" check: measure the visible rendered bracket bounds by taking the
    // tightest rect of the deepest rendered match cards (data-match-id elements).
    const matches = Array.from(container.querySelectorAll('[data-match-id]'));
    let contentBBox = null;
    if (matches.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      matches.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return; // ignore collapsed byes
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.right);
        maxY = Math.max(maxY, r.bottom);
      });
      if (minX !== Infinity) {
        contentBBox = { left: minX, top: minY, right: maxX, bottom: maxY,
                        width: maxX - minX, height: maxY - minY };
      }
    }

    // Overflow check — find descendants whose bounding box exceeds container bounds.
    const allDescendants = container.querySelectorAll('*');
    const overflows = [];
    const TOL = 2; // 2px tolerance for AA/rounded borders
    allDescendants.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.left < cRect.left - TOL
          || r.top < cRect.top - TOL
          || r.right > cRect.right + TOL
          || r.bottom > cRect.bottom + TOL) {
        overflows.push({
          tag: el.tagName,
          class: (el.className && el.className.toString) ? el.className.toString().slice(0, 60) : '',
          rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        });
      }
    });

    return {
      container: { left: cRect.left, top: cRect.top, right: cRect.right, bottom: cRect.bottom,
                   width: cRect.width, height: cRect.height },
      header: hRect ? { height: hRect.height, width: hRect.width,
                        left: hRect.left, right: hRect.right } : null,
      innerWrapper: wRect ? { height: wRect.height, width: wRect.width } : null,
      innerWrapperClient: wClient,
      contentBBox,
      overflowCount: overflows.length,
      overflowSamples: overflows.slice(0, 3),
      matchCount: matches.length,
    };
  });
}

function evaluateScenario(name, meta) {
  const issues = [];

  // Aspect check
  const aspect = meta.container.width / meta.container.height;
  const aspectDelta = Math.abs(aspect - EXPECTED_ASPECT);
  if (aspectDelta > EXPECTED_ASPECT * ASPECT_TOLERANCE) {
    issues.push(
      `aspect ratio off: got ${aspect.toFixed(3)}, expected ~${EXPECTED_ASPECT.toFixed(3)} (delta ${aspectDelta.toFixed(3)})`
    );
  }

  // Fill check — (header + inner content wrapper) should equal container height ± tolerance.
  // innerWrapper is the p-2 flex-1 sibling that contains AutoScaleWrapper.
  if (meta.header && meta.innerWrapper) {
    const combined = meta.header.height + meta.innerWrapper.height;
    if (Math.abs(combined - meta.container.height) > FILL_TOLERANCE_PX) {
      issues.push(
        `header+content ≠ container height: ${combined.toFixed(1)} vs ${meta.container.height.toFixed(1)} (tolerance ${FILL_TOLERANCE_PX})`
      );
    }
  }

  // Overflow check
  if (meta.overflowCount > 0) {
    issues.push(`${meta.overflowCount} descendants overflow container (samples: ${JSON.stringify(meta.overflowSamples)})`);
  }

  // Match count sanity — we should render something
  if (meta.matchCount === 0) {
    issues.push('no match cards rendered');
  }

  // Edge-gap check — bracket content (matches bounding box) must not touch the
  // rounded container edge on any side. Allow a small tolerance for sub-pixel
  // rounding. Header stays edge-to-edge (intentional), so we only check content.
  // Header's own horizontal edges ARE allowed to touch the container (divider line).
  if (meta.contentBBox && meta.container) {
    const MIN_EDGE_GAP = 10; // ≥10px gap on each side (padding is 14px so we have margin)
    const gaps = {
      left: meta.contentBBox.left - meta.container.left,
      right: meta.container.right - meta.contentBBox.right,
      top: meta.contentBBox.top - (meta.header ? meta.header.bottom || (meta.container.top + meta.header.height) : meta.container.top),
      bottom: meta.container.bottom - meta.contentBBox.bottom,
    };
    // Derive header.bottom if missing
    if (meta.header && !meta.header.bottom) {
      gaps.top = meta.contentBBox.top - (meta.container.top + meta.header.height);
    }
    ['left', 'right', 'top', 'bottom'].forEach(side => {
      if (gaps[side] < MIN_EDGE_GAP) {
        issues.push(`content touches ${side} edge: gap=${gaps[side].toFixed(1)}px (min ${MIN_EDGE_GAP})`);
      }
    });
    meta.edgeGaps = gaps;
  }

  // Sanity: content must fill at least 50% width and 40% height of container.
  // Without this, a scale=0.1 regression would still pass aspect/overflow/gap checks.
  if (meta.contentBBox && meta.container) {
    const widthRatio = meta.contentBBox.width / meta.container.width;
    const heightRatio = meta.contentBBox.height / meta.container.height;
    if (widthRatio < 0.5) {
      issues.push(`content too narrow: ${(widthRatio * 100).toFixed(1)}% of container (min 50%)`);
    }
    if (heightRatio < 0.4) {
      issues.push(`content too short: ${(heightRatio * 100).toFixed(1)}% of container (min 40%)`);
    }
  }

  return { scenario: name, passed: issues.length === 0, issues, meta };
}

async function resetToSetup(page) {
  const backBtn = await page.$('[data-testid="back-to-setup"]');
  if (backBtn) {
    await backBtn.click();
    await waitForSelector(page, '[data-testid="generate-bracket"]');
    await new Promise(r => setTimeout(r, 200));
  }
}

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const results = [];

  try {
    const page = await browser.newPage();
    // Letter landscape viewport @ 100dpi-ish so bracket-container gets near-true
    // display dims — height is calc(100vh - 160px), so viewport height drives it.
    await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 1 });
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 20_000 });
    } catch (err) {
      if (err.message.includes('ERR_CONNECTION_REFUSED') || err.message.includes('net::')) {
        console.error(`\nCannot reach ${BASE_URL}. Is 'npm run dev' running on port 5173?\n`);
        process.exit(2);
      }
      throw err;
    }

    for (const type of TYPES) {
      for (const count of COUNTS) {
        const label = `${count}-${type}`;
        console.log(`\n=== ${label} ===`);
        try {
          await resetToSetup(page);
          await configureBracket(page, count, type);
          const meta = await measureBracket(page);
          const result = evaluateScenario(label, meta);
          const screenshotPath = path.join(SCREENSHOT_DIR, `${label}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: false });
          result.screenshot = screenshotPath;
          if (result.passed) {
            console.log(`PASS  ${label}  aspect=${(meta.container.width/meta.container.height).toFixed(3)}  matches=${meta.matchCount}`);
          } else {
            console.log(`FAIL  ${label}`);
            result.issues.forEach(i => console.log(`      - ${i}`));
          }
          results.push(result);
        } catch (err) {
          console.log(`ERROR ${label}: ${err.message}`);
          results.push({ scenario: label, passed: false, issues: [`exception: ${err.message}`] });
        }
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    totalScenarios: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));
  console.log(`\n===== SUMMARY =====`);
  console.log(`Passed: ${summary.passed}/${summary.totalScenarios}`);
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);

  process.exit(summary.failed === 0 ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal verify error:', err);
  process.exit(2);
});
