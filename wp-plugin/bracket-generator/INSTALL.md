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
| `theme` | `interbasket`, `printerfriend`, `bw`, `classic`, `emerald`, `sunset`, `arctic`, `volcano`, `midnight`, `sakura`, `march-madness`, `world-cup` | `bw` | Brand-matched themes for your sites are `interbasket` and `printerfriend`. `march-madness` (navy/orange) and `world-cup` (green/gold) can be applied to any page — including the generic shortcode — without locking team count. |
| `ads` | comma-separated `top`, `bottom` | empty | If set, renders an ad slot above/below the bracket using your existing `[gard]` shortcode. Omit to place ads anywhere on the page yourself with a separate `[gard]`. |
| `variant` | `march-madness`, `world-cup` | _(none)_ | Locks the bracket into a preset mode (see section 4). When set, team count and bracket type are fixed and the UI controls for changing them are hidden. |

Examples:

- `[bracket-generator theme="interbasket"]` — bracket only, no ad slots
- `[bracket-generator theme="interbasket" ads="top"]` — ad above the bracket
- `[bracket-generator theme="printerfriend" ads="top,bottom"]` — ads above and below

## 4. Locked variants: March Madness & World Cup

Two shortcode variants lock the bracket into a preset mode — team count, bracket type, and default theme are all fixed. The visitor sees a purpose-built bracket page with no configuration controls.

| Variant | Teams | Type | Default theme | Heading |
|---------|-------|------|---------------|---------|
| `march-madness` | 64 | Single elimination | Navy / orange | Create Your March Madness Bracket |
| `world-cup` | 32 | Single elimination | Green / gold | Create Your World Cup Bracket |

**What the variant locks:**
- Team count is fixed — the Quick Presets buttons, custom-count input, "+ Add Participant" button, and per-team "×" remove buttons are all hidden from the visitor.
- Bracket type is forced to single elimination.
- The heading text updates automatically.

**What it does not lock:**
- The `theme` attribute still works. If you add `theme="..."` explicitly, the explicit theme wins over the variant's default (see note below). To use the variant's built-in theme, just omit `theme`.

### Deployment recipe for interbasket.net

You'll create two new WordPress pages — one per variant. Both pages should be **child pages** of your existing `/bracket-generator/` page so the URLs nest cleanly.

#### Step-by-step (do this once per variant)

In WP admin:

1. **Pages → Add New**.
2. **Title:** set your SEO title. Suggested:
   - March Madness page: `March Madness Bracket Generator — Free 64-Team Single Elimination`
   - World Cup page: `World Cup Bracket Generator — Free 32-Team Knockout Bracket`
3. **Permalink (URL slug):** after typing the title, click `Edit` next to the URL preview that appears under the title field. Set the slug to exactly:
   - `march-madness` (for the MM page)
   - `world-cup` (for the WC page)
4. **Page Attributes** (right sidebar — if you don't see it, click the gear icon at the top-right and toggle "Page Attributes" on):
   - **Parent:** select your existing **Bracket Generator** page from the dropdown. This nests the new page under `/bracket-generator/` so the final URL is `/bracket-generator/march-madness/`. Skip this and WP puts the page at `/march-madness/` (top level), which is not what you want.
   - **Order:** leave at `0`.
5. **Content area** — drop a Shortcode block (or paste as plain text in a Paragraph block — WP recognizes it either way):
   - MM page: `[bracket-generator variant="march-madness"]`
   - WC page: `[bracket-generator variant="world-cup"]`

   Add SEO copy (H1, intro paragraphs, "How to use this bracket" steps, FAQ) above and/or below the shortcode. Each variant page should target its own keywords (March Madness terms for MM; World Cup terms for WC).
6. **Yoast SEO** (if installed): set SEO title + meta description in the Yoast sidebar. See section 6 for templates and schema settings.
7. **Publish** (top right). Confirm in the dialog.
8. **Verify** the live URL in an **incognito window** (so you see what visitors see, not your logged-in admin view):
   - MM: `https://www.interbasket.net/bracket-generator/march-madness/`
   - WC: `https://www.interbasket.net/bracket-generator/world-cup/`

   The bracket should render with the variant-locked UI — heading shows the variant name, team count is fixed at 64 or 32, no preset buttons or "+ Add Participant" button visible.

Repeat for the second variant.

#### Quick-paste reference

If you've done this once and just want the essentials for the second page:

| Slug | Parent | Shortcode body | Final URL |
|---|---|---|---|
| `march-madness` | Bracket Generator | `[bracket-generator variant="march-madness"]` | `/bracket-generator/march-madness/` |
| `world-cup` | Bracket Generator | `[bracket-generator variant="world-cup"]` | `/bracket-generator/world-cup/` |

Both new pages are children of `/bracket-generator/`, consistent with your multi-page SEO structure (section 7).

### Post-deploy cache verification

After publishing both pages:

1. Open each page in an incognito window and do a hard-refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`).
2. Open browser devtools → **Console** tab, run:
   ```js
   window.BracketGenerator.version
   ```
   It must return the current plugin version (`'1.3.0'` as of this release). If it returns an older version string, an old JS bundle is still cached.
3. If stale: purge your CDN cache for the path `/wp-content/plugins/bracket-generator/dist/*`, then hard-refresh again.

### Theme override note

If you ever want to apply a different colour theme to a variant page (e.g., use black-and-white for print):

```
[bracket-generator variant="march-madness" theme="bw"]
```

This locks 64 teams (variant is active) but renders in black-and-white (`theme="bw"` wins). To restore the variant's default colours, remove the `theme` attribute entirely.

## 5. Customizing the intro copy

Anything you place **between** the opening and closing shortcode tags renders inside the bracket tool, just below the heading and subtitle, as a styled callout panel. The panel automatically picks up the active variant's theme colour — navy for `march-madness`, green for `world-cup`, or whatever `theme="..."` you've set.

### Basic example

```
[bracket-generator variant="world-cup"]
<p>The 2026 FIFA World Cup will once again bring together 48 national soccer teams for a month of unforgettable matches, knockout round drama, and global competition. Our 2026 World Cup Bracket Generator helps fans create printable and customizable tournament brackets...</p>
[/bracket-generator]
```

The `<p>` renders inside the tool with the variant's green callout styling — no theme attribute needed.

### Editing in the WordPress block editor

In Gutenberg, use a **Shortcode** block (not a Paragraph block — Paragraph blocks won't keep the HTML between the tags intact). Paste the full shortcode including the inner HTML and both opening/closing tags. To update the copy later, open the page, edit the HTML inside the Shortcode block, and **Update** the page. No plugin or code changes needed.

### Overriding the default callout style

If the themed callout doesn't suit a particular page (e.g., you want a neutral grey block, or you want the copy to look like plain body text), wrap the inner content in a `<div>` with inline styles. Inline styles win over the plugin's default styling:

```
[bracket-generator variant="march-madness"]
<div style="background:#f3f4f6; color:#111; padding:1rem; border-radius:8px;">
  Custom-styled intro paragraph.
</div>
[/bracket-generator]
```

### Allowed HTML

The plugin sanitizes inner content through WordPress's `wp_kses_post()` filter — the same filter WP uses for post content. That means standard post tags are allowed (`<p>`, `<a>`, `<strong>`, `<em>`, `<ul>`, `<li>`, `<div>` with `style` attributes, etc.) and anything dangerous (`<script>`, inline event handlers like `onclick="..."`) is stripped before it reaches the browser. If a tag or attribute doesn't render, it was probably filtered out — switch to a post-allowed equivalent.

### Known limitations

**Light-themed pages with intro HTML show white-on-white text.** The callout panel forces white text but inherits the active theme's header background colour. The bundled variants (`march-madness`, `world-cup`) use dark headers, so this works out of the box. If you override to a light theme via `theme="classic"` (or any of the other light-backgrounded themes — `emerald`, `sunset`, `arctic`, `volcano`, `midnight`, `sakura`) AND have intro HTML between the shortcode tags, the callout text becomes invisible against the white panel. **Workaround:** wrap your inner HTML with an explicit text colour, e.g. `<div style="color:#000">your copy here</div>`.

**Long team names can overflow card width on 64-team brackets.** In scroll mode (>32 teams), each card is ~170px wide. At the v1.3.0 font size, names longer than ~15 characters may overlap into adjacent match columns. This is the same overflow profile as v1.2.2 — abbreviated names like "UConn", "UNC", and "Duke" fit cleanly; full names like "University of Connecticut" don't. **Workaround:** use abbreviated team names for 64-team brackets.

## 6. SEO setup with Yoast

After publishing the page:

1. Open the page in WP admin → scroll to the **Yoast SEO** sidebar.
2. **SEO title:** suggested template `Free Bracket Generator | Create & Print Tournament Brackets`
3. **Meta description:** suggested `Create tournament brackets instantly. Free, customizable, and printable bracket generator for single elimination, round robin, and more.`
4. **Schema → Page type:** set to `WebPage`. **Article type:** set to `None` (this is a tool page, not an article).
5. **Schema → Custom fields:** if your Yoast tier supports custom blocks/fields, add `FAQPage` schema using the FAQ section of your copy. Free Yoast users can use a separate FAQ block plugin or manual JSON-LD via Yoast's "Schema → Custom" field.

Stuart-specific note: your SEO copy doc lists FAQ + SoftwareApplication schema as recommended. SoftwareApplication schema can be added via Yoast's "Schema → Custom" field with JSON-LD; ask if you want me to draft it.

## 7. Multi-page strategy

You can place the shortcode on as many pages as you want — each with different SEO copy targeting different keywords (e.g., `/bracket-generator/16-team/`, `/bracket-generator/basketball/`, etc.).

The shortcode is identical across pages; only the surrounding WP page copy changes. Each page Google indexes independently based on its unique copy.

The variant pages from section 4 (`/march-madness/` and `/world-cup/`) fit naturally into this structure as child pages of `/bracket-generator/`.

## 8. Updating the plugin

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
- If you see literal `[gard]` text rendered in the slot div, your AdSense plugin is deactivated or missing — re-activate it or remove the `ads="..."` attribute.

**The bracket appears but looks unstyled**
- The plugin's CSS file may not have loaded. Check browser devtools → Network tab for `bracket-generator.css` and confirm it returned 200 OK.

**Variant page heading reads the wrong title (e.g., shows "Bracket Generator" instead of "Create Your March Madness Bracket")**
- Check the `variant` attribute spelling in the shortcode. Typos (e.g., `varient`, `march_madness`) are silently ignored and the page falls back to the generic mode. Valid values are exactly `march-madness` and `world-cup`.

**Variant page shows the wrong team count, no scroll bar, or cut-off PNG export after a plugin update**
- This is almost always a CDN or browser cache serving the old JS bundle. Hard-refresh the page in an incognito window, then open the browser console and check `window.BracketGenerator.version` — it must match the current plugin version (`'1.3.0'` as of this release). If it still shows an older version, purge your CDN cache for `/wp-content/plugins/bracket-generator/dist/*` and hard-refresh again.

**Variant page is using the wrong colour theme**
- If you have an explicit `theme="..."` attribute on the shortcode, it overrides the variant's default theme. That's intentional. To use the variant's built-in colours, remove the `theme` attribute from the shortcode entirely.
