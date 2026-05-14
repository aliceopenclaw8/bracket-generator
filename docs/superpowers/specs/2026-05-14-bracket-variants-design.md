# Bracket Generator — March Madness & World Cup Variants

**Date:** 2026-05-14
**Status:** Draft for review
**Author:** Claude (Opus 4.7) for Wai Hoow Swee, relaying client request from Stuart at interbasket.net
**Scope decision:** A (minimal lock-in, no logos, no team prefill, no NCAA 4-region layout)

## Overview

Add two locked variants to the bracket-generator WordPress plugin so it can be embedded on dedicated landing pages with hard-coded team count, bracket type, and themed colors. The existing generic `[bracket-generator]` shortcode is preserved unchanged for users who want the full setup UI.

## User-facing behavior

Two new shortcode variants, plus the existing generic shortcode:

```
[bracket-generator]                            # unchanged — full generic tool
[bracket-generator variant="march-madness"]    # 64 teams, single elim, navy/orange theme
[bracket-generator variant="world-cup"]        # 32 teams, single elim, green/gold theme
[bracket-generator theme="emerald"]            # unchanged generic + explicit theme
[bracket-generator variant="march-madness" theme="bw"]  # variant locks, explicit theme overrides default
```

In variant mode, the setup panel changes as follows:

| Surface | Generic | Variant mode |
|---|---|---|
| Quick Presets buttons (4/8/16/32) | shown | **hidden** |
| Custom # of teams input | shown | **hidden** |
| `+ Add Participant` button | shown | **hidden** |
| `X` remove button on each team row | shown | **hidden** (count must stay locked at 64/32) |
| Team count | user picks | **forced** (64 MM / 32 WC) |
| Bracket type toggle (Single/Double) | shown | **hidden, forced Single** |
| Setup heading | "Create Your Bracket" | "Create Your March Madness Bracket" / "Create Your World Cup Bracket" |
| Team name inputs | "Team 1", "Team 2"… | unchanged — same generic placeholders, user fills in their picks |
| Blank / Add Teams toggle | shown | shown (this controls name-vs-empty mode, not count) |
| Theme picker | shown | **shown** (variant sets default — user can still change) |
| Layout toggle, seeds toggle, export buttons | shown | unchanged |
| Randomize button, drag-to-reorder | shown | shown (these reorder existing teams, do not change count) |

Two new color themes added to the global theme list, also usable on the generic shortcode:

- `march-madness`: navy `#1A2B5C` background + orange `#FF8200` accent
- `world-cup`: pitch green `#006633` background + gold `#FFCC00` accent

## Architecture

Single mechanism: shortcode attribute → DOM data attribute → React prop.

```
WordPress shortcode
  ↓ ($atts['variant'])
PHP whitelists & emits <div data-variant="..." data-theme="..." data-ads-mid-html="...">
  ↓
main.jsx mount() reads container.dataset.variant
  ↓ prop: variant
App.jsx
  ↓ prop: variant
SetupPanel.jsx — branches rendering on variant
```

No new shortcodes. No URL-aware logic in JS. No PHP rewriting of HTML. Single new attribute, single source of truth.

### Whitelist

PHP-side validation. Acceptable values: `'march-madness'`, `'world-cup'`, `''` (empty/missing). Anything else is treated as empty (silent fallback to generic). No error message — invalid values just behave like the generic shortcode. Rationale: a typo in a shortcode shouldn't break the page.

### Theme precedence

To make "explicit theme wins" work correctly, the PHP shortcode default for `theme` must change from `'bw'` to `''` (empty string). Final theme resolution happens in JS:

1. If shortcode `theme` attribute is a non-empty string → use it (explicit user choice wins).
2. Else if `variant` is set → use that variant's default theme (`march-madness` or `world-cup`).
3. Else → use the app default (`'bw'`).

Rationale: explicit user choice > variant default > app default. The PHP-layer default change is required so we can distinguish "user didn't pick a theme" from "user picked `bw`".

Side effect to verify during implementation: any existing WP pages with `[bracket-generator]` (no theme attr) will continue to render `bw` because of step 3. No behavior change for existing deployments.

### Forced state per variant

| Variant | Team count | Bracket type | Default theme | Heading |
|---|---|---|---|---|
| `march-madness` | 64 | `'single'` | `march-madness` | "Create Your March Madness Bracket" |
| `world-cup` | 32 | `'single'` | `world-cup` | "Create Your World Cup Bracket" |

## Components affected

| File | Change |
|---|---|
| `wp-plugin/bracket-generator/bracket-generator.php` | Add `'variant' => ''` to `shortcode_atts` defaults. Whitelist values via `in_array`. Change `'theme'` default from `'bw'` to `''` (see Theme precedence section). Emit `data-variant="$variant"` on the mount div. Bump plugin header version `1.1.0` → `1.2.0`. |
| `src/main.jsx` | Inside `mount(container, options)`, resolve variant via `options.variant \|\| container.dataset.variant \|\| ''` (mirrors how `theme` resolution already works — see existing code reading `container.dataset.theme` and `container.dataset.adsMidHtml`). Pass resolved variant as prop to `<App />`. Also bump `window.BracketGenerator.version` from `'1.0.0'` to `'1.2.0'` to match plugin header — this is the only client-side version signal for detecting bundle/PHP mismatch in production. |
| `src/App.jsx` | Accept `variant` prop. Use `useState(() => ...)` **lazy initializer** for both `participantNames` (64 entries for `march-madness`, 32 for `world-cup`) and `bracketType` (`'single'`) — lazy init runs once per mount, so user-typed team names are NOT reset on StrictMode double-invoke or parent re-renders. Resolve final theme: non-empty `theme` prop > variant default > `'bw'` (see Theme precedence section). Pass `variant` down to `<SetupPanel />`. |
| `src/components/SetupPanel.jsx` | Accept `variant` prop. Conditionally hide: presets section (find by `presets` array literal), custom-count input (find by `handleCustomCount`), bracket-type toggle (find by `bracketType` state setter use), `+ Add Participant` button (find by `addParticipant` handler), per-team `X` remove buttons (find by `removeParticipant` handler). Swap heading text based on variant. Implementer should re-locate each section by symbol name, not line number. |
| `src/utils/themes.js` | Add `march-madness` and `world-cup` theme objects following existing theme shape — **13 keys**: `name`, `bg`, `cardBg`, `cardBorder`, `accent`, `text`, `textMuted`, `winnerBg`, `winnerText`, `roundLabel`, `connector`, `headerBg`, `preview`. Use `interbasket` (current line ~137) as the template. `name` is required — ThemePicker reads it for the label. |

## Out of scope (explicit non-goals)

These were considered and deliberately excluded. Revisit only on explicit user request:

- ❌ Logos of any kind (decorative top-of-page, per-team cards, watermark, export overlay)
- ❌ Pre-filled real team names (NCAA field, World Cup participants)
- ❌ NCAA 4-region (East/West/South/Midwest) layout — flat single-elim only
- ❌ First Four play-in support (NCAA actually has 68 teams; we lock at 64)
- ❌ World Cup group stage UI — KO bracket only, matching client's exact framing
- ❌ Hiding the theme picker in variant mode (user can still change theme)
- ❌ Variant-specific branding bleeding into PNG/PDF export beyond theme colors
- ❌ Data-driven variant config (hardcoded for these two variants; revisit if a third is requested)

## Risks accepted

These were surfaced during design and the user explicitly chose to accept the trade-off. Revisit if user feedback / metrics warrant.

1. **Flat 64-team bracket on mobile.** A 6-round-wide bracket will require horizontal scrolling on phones and will not visually resemble the printed NCAA bracket fans recognize. Fix-if-needed: scope E (4-region layout).
2. **No team prefill = blank canvas.** Every user types all 64 / 32 team names manually. May reduce engagement on a March Madness landing page vs a pre-filled experience. Fix-if-needed: scope C (real-team prefill).
3. **Hardcoded variants, not config-driven.** Adding a third variant (e.g., Euro 2028, NBA Playoffs) requires code changes in 4 files, not a config edit. Fix-if-needed: refactor to data-driven variant registry on the third variant.

## Implementation notes (deferred to writing-plans phase)

The following are verified facts established during spec review, not unknowns:

- **No localStorage / sessionStorage in `src/`.** Verified via grep — bracket state lives entirely in React `useState` in `App.jsx` (lines 23-35 at time of writing) and is lost on page reload. No persistence migration required.
- **Exact line numbers will drift.** Implementation agent must locate code by symbol name (e.g., `presets`, `handleCustomCount`, `bracketType`, `THEMES.interbasket`), not line numbers from this spec.
- **Theme object shape: 13 keys.** New theme objects must include `name` (required by ThemePicker for label) plus the 12 visual keys. Diff against `THEMES.interbasket` as the template.
- **`feedbackUrl` asymmetry (informational, not a change here).** `main.jsx` reads `container.dataset.feedbackUrl` with a mailto fallback, but the PHP shortcode does not currently emit `data-feedback-url`. This pre-existing asymmetry is not introduced by this spec and is not in scope to fix.

## Stuart's deployment steps

1. Receive updated plugin zip from Wai Hoow (bumped to v1.2.0).
2. Update plugin on interbasket.net via WP plugin admin → upload zip → replace existing.
3. Create two new WP pages with these slugs and bodies:
   - Slug `/bracket-generator/march-madness/` — body: `[bracket-generator variant="march-madness"]`
   - Slug `/bracket-generator/world-cup/` — body: `[bracket-generator variant="world-cup"]`
4. The existing `/bracket-generator/` page (generic shortcode) needs no changes — it continues to work as before.
5. **Cache verification (important).** After deploy, open both new pages in an **incognito / private window** and hard-refresh (Cmd+Shift+R / Ctrl+Shift+F5). Open the browser console and run `window.BracketGenerator.version` — it must report `'1.2.0'`. If it reports `'1.0.0'`, an old bundle is cached by the browser or by Cloudflare/CDN in front of WP, and variant pages will silently render as the generic 64-team UI. If cached, purge the CDN cache for `/wp-content/plugins/bracket-generator/dist/*` and re-test. The PHP plugin uses `filemtime()` for cache-busting, but that only invalidates server-cached versions — CDN and browser caches need separate handling.

## Testing checklist

- [ ] `[bracket-generator]` (no variant) — full setup UI, all presets visible, behavior unchanged from v1.1.0
- [ ] `[bracket-generator variant="march-madness"]` — locked to 64 teams single elim. All these MUST be hidden: presets buttons, custom-count input, bracket-type toggle, `+ Add Participant` button, per-team `X` remove buttons. Heading is "Create Your March Madness Bracket". Default theme is navy/orange. Team count remains 64 even after clicking Generate and Back to Setup.
- [ ] `[bracket-generator variant="world-cup"]` — locked to 32 teams single elim. Same hidden-UI set as MM. Heading is "Create Your World Cup Bracket", default theme is green/gold. Team count remains 32 after Generate → Back to Setup round-trip.
- [ ] `[bracket-generator variant="march-madness" theme="bw"]` — `theme="bw"` is applied **AND** all variant lockdowns still hold: team count is forced to 64, single elim is forced, all team-count-changing UI hidden (presets, custom count, bracket-type toggle, +Add, X remove), heading is "Create Your March Madness Bracket". The `theme` override must not regress any variant lock.
- [ ] `[bracket-generator variant="nonsense"]` — falls back silently to generic (no error, no console warning shown to end users); renders with the app default theme (`bw`) because no variant matched and no `theme` was set.
- [ ] `[bracket-generator theme="march-madness"]` — generic shortcode with new MM theme works (no team-count lock); presets and bracket-type toggle remain visible because no `variant` is set.
- [ ] Theme picker still works inside variant mode (user can manually change to another theme; team-count lock and bracket-type lock remain).
- [ ] PNG export, PDF export still produce correct output in variant mode.
- [ ] Auto-scroll behavior, ads slots, layout toggle, seeds toggle all unchanged in variant mode.
- [ ] Two shortcodes on the same WP page (one generic, one variant) render independently without state collision.
- [ ] **Two variant shortcodes on the same WP page** — e.g., `[bracket-generator variant="march-madness"]` followed by `[bracket-generator variant="world-cup"]` — each maintains its own state (typing in one does not affect the other, theme picker on one does not change the other). Confirms per-container React root independence.
- [ ] **Cache check after deploy** — `window.BracketGenerator.version === '1.2.0'` in the browser console on an incognito hard-refresh of both new pages.
