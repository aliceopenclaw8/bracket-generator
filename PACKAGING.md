# WordPress Integration — PACKAGING

**Last updated:** 2026-04-27
**Status:** Stuart confirmed his WP setup. v1 scope locked. Next: invoke `superpowers:writing-plans` to produce the detailed implementation plan, get Swee's approval, then build (~2-3 days).

---

## AGENT BRIEFING — READ FIRST

**You are picking up a paused workstream.** This file is the resumption point for shipping the bracket generator into Stuart Leung's two WordPress sites (`interbasket.net` and `printerfriend.ly`).

### State machine: what to do based on where things are

1. **First action: ask Swee for the current build state.** Possibilities:
   - **Plan not yet written** → invoke `superpowers:writing-plans` to convert the "v1 build plan" section below into a step-by-step implementation plan. Get Swee's approval. Then invoke `superpowers:executing-plans`.
   - **Plan written, not yet executed** → ask Swee whether to start. If yes, invoke `superpowers:executing-plans`.
   - **Build in progress** → ask which step. Pick up there.
   - **Build complete, awaiting client install** → coordinate plugin .zip handoff to Stuart via Swee.

2. **Highest engineering risk = Tailwind v4 preflight isolation.** Spike this first (~2h) before scoping the rest. If preflight scoping is harder than expected, the entire timeline shifts.

3. **Use the credentials in `.env.local`** for: capturing interbasket brand identity (still TBD — see Brand Recon section), installing the plugin on real sites for test, and post-build verification.

### Hard constraints (don't relitigate)

- **We do not host.** Stuart hosts on his own infrastructure (`hosting.com`, ex-A2 Hosting, both sites). Reject any path that requires our hosting.
- **TAPVI is mandatory** (Think → Ask → Plan → Verify → Implement) per `~/.claude/CLAUDE.md`. Skipping Ask/Verify wastes Swee's context and trust.
- **Be a ruthless sparring partner**, not a yes-agent. Push back on Swee's plans if you spot blind spots. Cite sources when unsure. Call out fishing for validation.
- **Startup pace, not military-grade.** Resist scope creep — no CMS update servers, no telemetry, no analytics integrations unless asked.
- **Use subagents in parallel** for codebase audits (`Explore`) and research (`search-specialist`). Don't burn main session context on parallelizable lookups.
- **Append a simple-English summary** after technical explanations (Swee preference).

### Already considered and rejected — don't re-propose

- Iframe with our hosting — eliminated by "we don't host"
- Iframe with Stuart's cPanel-hosted source — splits SEO signal across two URLs
- Static `dist/` + cPanel as **primary** path — Stuart can't edit copy in WP (acceptable only as fallback)
- Next.js SSR rewrite — overkill, content is static
- GH Pages on Stuart's account + custom subdomain — subdomain ≠ subdirectory for SEO
- Programmatic SEO templates / 100+ pages / preset attributes — explicitly out of v1 scope

### Skills to auto-invoke as relevant

- `superpowers:brainstorming` — if scope expands beyond this doc
- `superpowers:writing-plans` — **next step right now**
- `superpowers:executing-plans` — during the build
- `superpowers:test-driven-development` — for plugin build (especially the Tailwind isolation work)
- `superpowers:verification-before-completion` — before claiming any milestone done
- `commit` / `commit-push-pr` — only when Swee explicitly asks

**If anything below this briefing contradicts the briefing, the briefing wins** (most recent intent).

---

## Context

Client: Stuart Leung. Two WP sites: `interbasket.net` and `printerfriend.ly`. He approved the bracket generator and wants it integrated into both, with SEO ranking as a primary goal. He shared a Google Doc with full SEO copy for both pages: https://docs.google.com/document/d/13iVTC2T_KgVeUTAXRffLrKfdM8L9rCrf7zpWNV2mzZA/edit (interbasket version is professional/sport-focused; printerfriendly version is casual/playful with emojis — different copy per site, which solves duplicate-content).

**Hard constraint:** WE DO NOT HOST. Stuart hosts on his own infrastructure.

## Decision: WordPress shortcode plugin

Ship the bracket generator as a small WP plugin. Stuart installs once per site, drops `[bracket-generator theme="..." ads="..."]` on any WP page. SEO copy lives in WP, edited by Stuart in Classic Editor. Yoast handles FAQ + SoftwareApplication schema.

### Why this won (and what we rejected)

| Path | Verdict |
|---|---|
| Iframe + our hosting | Killed by "we don't host" constraint |
| Iframe + Stuart's cPanel subdir + iframe from WP | Splits SEO signal across two URLs on his domain |
| Static `dist/` on his cPanel + SEO copy baked into build | Stuart can't edit copy in WP — we become bottleneck for every edit |
| Next.js SSR rewrite | Overkill — content is static, not dynamic |
| GH Pages on Stuart's account + custom subdomain | Subdomain ≠ subdirectory for SEO; DNS friction |
| **WP shortcode plugin** | **Chosen.** Tool inline on WP page, one URL on his domain, copy in WP |

Rationale anchor: John Mueller (Google) — "If you have something you absolutely want indexed within the context of a page, I'd work to include it directly." Iframe content's SEO accrues to the iframe source URL, not the parent.

## Stuart's confirmed setup

| | Both sites |
|---|---|
| Host | hosting.com (ex-A2 Hosting). Standard cPanel-based shared hosting. Plugin uploads work. |
| SEO plugin | Yoast |
| Page builder | Classic Editor (the easiest possible setup for shortcode integration — shortcodes render natively, no block-builder rendering quirks) |
| Setup parity | Same setup both sites |
| Page URL slug | **`/bracket-generator/`** at root on both sites — `https://www.interbasket.net/bracket-generator/` and `https://printerfriend.ly/bracket-generator/`. Confirmed by client. |

Stuart asked if we recommend switching hosts — answer was no, hosting.com is fine; suggested adding Cloudflare in front for free CDN/Core-Web-Vitals boost if not already.

## v1 requirements (confirmed)

### Must-have

1. **WP shortcode plugin** registering `[bracket-generator theme="..." ads="..."]`
2. **Two brand-matched theme variants:** `interbasket` and `printerfriend`
3. **Feedback mailto link** in the tool footer: `mailto:interbasketmedia@gmail.com?subject=Bracket%20Generator%20problem`
4. **Optional ad slots** (top/bottom) — conditionally emitted based on `ads` shortcode attribute. Wrapper divs render `[gard]` shortcode server-side via `do_shortcode()`, OUTSIDE the React mount (to avoid React unmounting AdSense's `<ins>` elements during re-renders). If `ads` attribute is absent, no slots emitted — Stuart can place `[gard]` directly on the WP page wherever he wants.
5. **Tailwind preflight isolation** scoped to `#bracket-root` so the plugin doesn't smash WP theme styling
6. **Multi-instance safety** — unique mount IDs in case of multiple shortcodes per page
7. **Build pipeline** — `npm run build:plugin` emits `bracket-generator.zip` ready for WP upload
8. **Install README** for Stuart (install plugin, create WP page, paste SEO copy from his doc, configure FAQ schema in Yoast, drop shortcode)

### Stuart owns (not us)

- Writing SEO copy on each WP page (separate copy per site — interbasket vs printerfriendly versions in his doc)
- Configuring Yoast FAQ + SoftwareApplication schema on each page
- Placing `[gard]` ad shortcodes on the WP page (either via our optional slot attribute OR directly in the post body wherever he wants)

### Deferred (v1.1+)

- Preset attributes (`preset="16-team-single-elim"` to auto-configure tool on page load)
- Programmatic SEO page templates / 100+ pages
- Additional theme variants beyond the 2 confirmed sites
- WP plugin update server

## Brand recon (for theme variants)

### printerfriend.ly — VERIFIED via public site recon

| Token | Value |
|---|---|
| Primary accent | `#52C0D4` (teal — links, hover states) |
| Nav/highlight background | `#EF4423` (orange-red) |
| Body text | `#555` (dark gray) |
| Surface backgrounds | `#f7f7f7` light gray |
| Heading & body font | Arial sans-serif (system stack) |
| Blockquote font | Georgia, Bitstream Charter serif |
| Border radius | 5px (subtle rounded corners) |
| WP theme | MesoColumn |
| Vibe | utilitarian, casual, content-library feel |

### interbasket.net — TBD (Cloudflare blocked the search agent)

The search-specialist subagent could not directly inspect interbasket.net's CSS because the site is Cloudflare-protected. The agent inferred (from Google search snippets, NOT direct verification) that interbasket might be a phpBB forum. **This is unverified speculation.** Stuart explicitly said both sites are WP+Yoast+Classic Editor and provided WP admin credentials, which is strong counter-evidence.

**Plan during build phase:** use `.env.local` credentials with Puppeteer (already a dev dep) to log into interbasket WP admin, capture theme/colors/fonts/plugin list, AND empirically confirm WP platform. If interbasket turns out hybrid (WP + phpBB co-existing), get WP path from Stuart. If pure phpBB (extremely unlikely given his answers), pivot to Path B fallback.

## Credentials

Stuart provided WP admin access for both sites. Saved in `.env.local` at repo root (gitignored via `*.local` pattern):

- `INTERBASKET_WP_USER`, `INTERBASKET_WP_PASS`, `INTERBASKET_WP_ADMIN_URL`
- `PRINTERFRIEND_WP_USER`, `PRINTERFRIEND_WP_PASS`, `PRINTERFRIEND_WP_ADMIN_URL`

Use these for: Puppeteer brand recon on interbasket, plugin install/test on real sites, post-build verification.

## v1 build plan (~2-3 days, expanded)

| Step | Hours | Notes |
|---|---|---|
| 1. Tailwind preflight isolation spike | 2 | **DO FIRST.** Validate scoping approach (`important: '#bracket-root'` vs strip-and-replace preflight) on a clean WP install before scoping the rest. Highest risk — if this is harder than expected, timeline shifts. |
| 2. Interbasket brand recon via Puppeteer | 1 | Login with `.env.local` creds, capture colors/fonts/theme. Confirms WP platform empirically. |
| 3. WP plugin scaffold | 4 | Plugin header + activation; shortcode registration with `theme` and `ads` attributes; conditional script/style enqueue (only on pages with shortcode); output wrapper HTML with optional ad slots calling `do_shortcode('[gard]')`; React mount div with unique ID + data-theme. |
| 4. Vite build adjustments | 4 | Library/non-app mode; mount to dynamic div ID instead of fixed `#root`; read theme from container's `data-theme`. |
| 5. Theme variants — printerfriend + interbasket | 3 | Add two new entries to `THEMES` object (existing structure supports this trivially); printerfriend uses verified tokens; interbasket uses recon results from step 2. |
| 6. Feedback mailto link | 0.5 | Footer of tool; mailto with prefilled subject. |
| 7. Multi-instance safety | 2 | Unique mount IDs; ensure module is idempotent if loaded twice. |
| 8. Build pipeline | 2 | `npm run build:plugin` → bundles JS + CSS into plugin folder structure → zips to `bracket-generator.zip`. |
| 9. Real-site testing | 3 | Install plugin on both sites (using `.env.local` creds), create test WP pages, verify shortcode rendering, ad slots, theme variants, mobile responsive. |
| 10. Install README | 2 | Step-by-step install for Stuart with screenshots. |

**Total: ~24 hours of focused work, ~2-3 calendar days.**

## Fallbacks (only if v1 build hits a blocker)

| Issue | Fallback |
|---|---|
| Tailwind preflight cannot be cleanly scoped (theme conflicts persist) | Shadow DOM isolation — heavier but bulletproof. Adds ~6h. |
| Plugin upload blocked on hosting.com (unlikely; standard cPanel host) | Path B: static `dist/` on his cPanel at `/bracket-generator/`, SEO copy baked into build. Stuart sends copy edits to us; we rebuild + send new files. |
| Interbasket turns out non-WP (very unlikely given Stuart's answers) | Investigate platform; if hybrid, integrate at WP path; if pure non-WP, ship plugin to printerfriend only and propose Path B for interbasket. |
| `[gard]` shortcode doesn't expand inside our wrapper | Verify `do_shortcode()` is being called correctly; check shortcode registration order; worst case Stuart places `[gard]` outside our shortcode on the WP page. |

## Codebase facts

- Vite + React 19 SPA, plain JS
- `vite.config.js` has `base: '/bracket-generator/'` — needs adjustment for plugin mode (likely root-relative or empty base)
- Mount point: `<div id="root">` in `index.html` — needs dynamic mount for plugin (read container ID from data attribute)
- Themes: central `THEMES` object with 8 schemes (bw, classic, emerald, sunset, arctic, volcano, midnight, sakura), prop-driven — adding `interbasket` + `printerfriend` is trivial
- Components: Header, SetupPanel, BracketView, BracketRound, MatchCard, BracketConnectors, ExportButtons, ThemePicker
- Puppeteer is a dev dep (`v24.41.0`) — already used for `npm run verify` script
- Current GH Pages auto-deploy at `aliceopenclaw8.github.io/bracket-generator/` via `.github/workflows/deploy.yml` — keep as staging/preview, not production

## Resolved architectural decisions

1. **Theme attribute vs hostname auto-detection** → **explicit `theme="..."` attribute**. More flexible (Stuart can preview themes by toggling), foolproof when both sites embed same plugin.
2. **Bundle CDN vs bundled-with-plugin** → **bundled-with-plugin** (single zip, no external dep, simpler distribution).
3. **Plugin update mechanism** → **manual zip uploads by Stuart** for now. Update server overkill for 2 sites.
4. **Ad placement** → **optional slots top/bottom OUTSIDE React mount, server-side `[gard]` expansion via `do_shortcode()`**. Stuart can also place `[gard]` directly on the WP page if he prefers.

## Unrelated workstream (NOT part of this WP integration)

Per session memory: winner-slot-below-bracket implementation (Option A) confirmed but not yet built. Separate UI task. Don't conflate with the WP integration plan above.
