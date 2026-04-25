# WordPress Integration — PACKAGING

**Last updated:** 2026-04-25
**Status:** Awaiting Stuart's answers to 4 questions before build starts.

---

## AGENT BRIEFING — READ FIRST

**You are picking up a paused workstream.** This file is the resumption point for shipping the bracket generator into Stuart Leung's two WordPress sites.

### State machine: what to do based on where things are

1. **First action: ask Swee whether Stuart has replied to the 4-question email** (see "BLOCKED ON" section below).

2. **If Stuart has NOT replied yet:**
   - Do **not** pre-build. The plugin path is the working assumption but isn't locked until host/builder/SEO-plugin compatibility is confirmed.
   - Other workstreams may be active (e.g., the unrelated winner-slot UI task at the bottom of this file). Ask Swee what to focus on.

3. **If Stuart's reply is compatible with the plugin path** (typical host like SiteGround / Bluehost / cPanel-managed; Yoast or Rank Math; Gutenberg or Elementor; both sites similar):
   - Invoke `superpowers:writing-plans` to convert the "Build plan" section below into a detailed implementation plan.
   - Get Swee's approval on the plan.
   - Then invoke `superpowers:executing-plans` and start building.
   - **Highest engineering risk:** Tailwind v4 preflight isolation from his WP theme CSS. Spike this first (~2h) before scoping the rest.

4. **If Stuart's reply rules out the plugin path** (managed host blocks custom plugin uploads, page builder strips shortcodes, or Stuart hesitates on installing a custom plugin):
   - Switch to **Path B fallback** (static `dist/` on his cPanel at `/bracket-generator/`, SEO copy baked into build).
   - **Re-confirm with Swee before pivoting** — don't switch architecture silently.

### Hard constraints (don't relitigate)

- **We do not host.** Stuart hosts on his own infrastructure. Reject any path that requires our hosting.
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

### Skills to auto-invoke as relevant

- `superpowers:brainstorming` — if scope expands beyond this doc
- `superpowers:writing-plans` — after Stuart confirms, before coding
- `superpowers:executing-plans` — during the build
- `superpowers:test-driven-development` — for plugin build (especially the Tailwind isolation work)
- `superpowers:verification-before-completion` — before claiming any milestone done
- `commit` / `commit-push-pr` — only when Swee explicitly asks

**If anything below this briefing contradicts the briefing, the briefing wins** (it's the most recent intent).

---

## Context

Client: Stuart Leung. Two WP sites: `interbasket.net` and `printerfriend.ly`. He approved the bracket generator and wants it integrated into both, with SEO ranking as a primary goal. He shared a ~810-word SEO copy doc (https://docs.google.com/document/d/13iVTC2T_KgVeUTAXRffLrKfdM8L9rCrf7zpWNV2mzZA/edit) covering H1 + 6 H2s + 4 H3 features + 4-Q&A FAQ, with FAQ + SoftwareApplication schema recommended and a multi-page strategy planned (`/bracket-generator/16-team-single-elimination`, sport-specific pages, team-size pages).

**Hard constraint:** WE DO NOT HOST. Stuart hosts on his own infrastructure.

## Decision: WordPress shortcode plugin

Ship the bracket generator as a small WP plugin. Stuart installs once per site, drops `[bracket-generator theme="..."]` on any WP page. SEO copy lives in WP, edited by Stuart.

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

## BLOCKED ON: Stuart's reply to 4 questions

Email drafted for Swee to send Stuart:

> Hey Stuart,
>
> Got your message. Quick answers + plan, then 4 questions back so we can lock the build in.
>
> **Direct answers to what you asked:**
>
> - **Credentials:** WP admin only. **No cPanel needed.**
> - **Cut/paste-able into a WP page:** Yes — you'll paste a short tag like `[bracket-generator]` onto the page. The actual code lives in a small WordPress plugin you install once per site (uploaded through WP admin like any other plugin).
> - **URL:** Either `/bracket-generator/` or `/brackets/generator` works — they're just WP page slugs you choose. **My recommendation: `/bracket-generator/` at root.** Shorter URLs rank slightly better and you'll have room to expand into `/bracket-generator/16-team-single-elimination/`, sport-specific pages, etc. like the slugs in your doc.
> - **Two sites looking different:** Yes, easy. The shortcode takes a theme attribute — `[bracket-generator theme="interbasket"]` vs `[bracket-generator theme="printerfriend"]` — different colors, typography, visual feel. One honest note: visual differences alone don't solve duplicate-content. What does the heavy lifting is the unique SEO copy you're already writing per page. The visuals reinforce it.
>
> **The plan (and why plugin, not iframe):**
>
> I'll build a small WordPress plugin you install once on each site. After that you create WP pages as normal, write your SEO copy in the editor, drop `[bracket-generator]` where you want the tool to appear, and Yoast/Rank Math handles the FAQ + SoftwareApplication schema like always.
>
> The reason for plugin over a paste-in-iframe approach: iframes split the SEO signal between the WP page and the iframe source URL. Given how seriously you're investing in copy and schema, that split would cost ranking. The plugin renders the tool *inline on your WP page* — Google sees one URL on your domain with copy + tool together. Best for ranking.
>
> **4 quick questions before I start:**
>
> 1. **What WP host are you on for each site?** (e.g., SiteGround, Bluehost, WP Engine, Kinsta, GoDaddy.) Some managed hosts restrict custom plugin uploads — want to confirm both allow it.
> 2. **What SEO plugin do you use?** (Yoast, Rank Math, AIOSEO, something else.) We'll lean on it for schema markup.
> 3. **How do you build WP pages?** (Gutenberg blocks, Elementor, Divi, classic editor.) Most are fine — just confirming shortcode compatibility.
> 4. **Are interbasket.net and printerfriend.ly on the same setup, or different?** If different, answers to 1-3 might vary per site.
>
> Once I have those four, I'll start the build. Rough timeline: 2-3 days to the first installable version.
>
> Cheers,
> Swee

## Once Stuart replies — build plan (~2-3 days)

1. **WP plugin scaffold** (4h) — plugin header, activation, shortcode registration, conditional script/style enqueue, output `<div id="bracket-root-{unique}" data-theme="...">`
2. **Vite build adjustments** (4h) — library mode or non-app mode; mount to dynamic div ID instead of fixed `#root`; read `data-theme` from container
3. **Tailwind preflight isolation** (4–8h) — KEY RISK. Tailwind v4 preflight resets `h1`/`h2`/`button` globally and will smash WP theme styling. Approach: scope all Tailwind utilities via `important: '#bracket-root'`, OR strip preflight + write custom scoped reset, OR Shadow DOM (overkill). Verify on default WP theme + Stuart's actual theme.
4. **Multi-instance safety** (2h) — unique mount IDs for multiple shortcodes per page
5. **Build pipeline** (2h) — `npm run build:plugin` → emits `bracket-generator.zip` ready for WP upload
6. **Testing + install README** (4h) — clean WP install + Stuart's setup

## Fallbacks (only if Stuart's reply rules out the plugin)

| Issue in his reply | Fallback |
|---|---|
| Host blocks custom plugin uploads (occasional WP Engine / Kinsta / Pantheon configs) | Path B: static `dist/` on his cPanel at `/bracket-generator/`, SEO copy baked into the build. Stuart sends copy edits to us; we rebuild + send new files. |
| Page builder strips shortcodes (some Divi configs) | Provide HTML/code-block install instructions specific to that builder |
| Stuart hesitates on installing a custom plugin (security caution) | Same Path B fallback as above |

## Codebase facts (so future-me doesn't re-derive)

- Vite + React 19 SPA, plain JS
- `vite.config.js` has `base: '/bracket-generator/'` — needs adjustment for plugin mode
- Mount point: `<div id="root">` in `index.html` — needs dynamic mount for plugin
- Themes: central `THEMES` object with 8 schemes (bw, classic, emerald, sunset, arctic, volcano, midnight, sakura), prop-driven — theme variant via shortcode attribute is trivial
- Components: Header, SetupPanel, BracketView, BracketRound, MatchCard, BracketConnectors, ExportButtons, ThemePicker
- Current GH Pages auto-deploy at `aliceopenclaw8.github.io/bracket-generator/` via `.github/workflows/deploy.yml` — keep as staging/preview; not the production deployment

## Open architectural decisions (resolve after Stuart replies)

1. **Theme attribute vs hostname auto-detection** — explicit `theme="..."` attribute is more flexible; auto-detect from hostname is foolproof but rigid. Lean explicit.
2. **Bundle CDN vs bundled-with-plugin** — bundle JS inside plugin folder (single zip, no external dep). Lean bundle-with-plugin.
3. **Plugin update mechanism** — manual zip upload by Stuart for now (overkill to host an update server for 2 sites).

## Unrelated workstream (NOT part of this WP integration)

Per session memory: winner-slot-below-bracket implementation (Option A) confirmed but not yet built. Separate UI task. Don't conflate with the WP integration plan above.
