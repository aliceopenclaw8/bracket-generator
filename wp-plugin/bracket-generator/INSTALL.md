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
- If you see literal `[gard]` text rendered in the slot div, your AdSense plugin is deactivated or missing — re-activate it or remove the `ads="..."` attribute.

**The bracket appears but looks unstyled**
- The plugin's CSS file may not have loaded. Check browser devtools → Network tab for `bracket-generator.css` and confirm it returned 200 OK.
