# Bracket Generator Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `variant="march-madness"` and `variant="world-cup"` shortcode attributes that lock team count (64/32), force single elim, swap the setup heading, and apply a themed color scheme — without breaking the existing generic `[bracket-generator]` shortcode.

**Architecture:** Single new shortcode attribute → emitted as `data-variant` on the mount div → read by `main.jsx` and passed as a React prop down to `App.jsx` → `App.jsx` lazily initializes `participantNames` based on variant and passes variant to `SetupPanel.jsx`, which hides team-count-changing UI and swaps the heading text. Two new theme entries added to the global theme registry.

**Tech Stack:** React 19 + Vite (bundled into single ES module) + WordPress plugin shim (PHP shortcode rendering `<div data-*>` + inline mount script). No test framework in repo — verification is build success + manual visual check, per project convention.

**Spec reference:** `docs/superpowers/specs/2026-05-14-bracket-variants-design.md`

**Project conventions worth knowing:**
- User explicitly says "don't run npm run dev yourself, ask user to verify" — implementer must ask Wai Hoow to visually verify, not auto-run dev server
- User explicitly says "NEVER commit unless I ask you to" — every "commit" step in this plan means "suggest commit with this message; wait for user approval"
- No test framework exists in the repo; per-task verification is `npm run build:plugin` (catches compile errors only) plus user manual verification at the end
- All five files changed are small enough to be modified by symbol lookup, not line number — line numbers will drift between writing this plan and running it

---

## File structure (5 files modified, 0 created)

| File | Responsibility | Approx. size of change |
|---|---|---|
| `wp-plugin/bracket-generator/bracket-generator.php` | Shortcode boundary: accept `variant` attr, validate, emit as `data-variant`. Change `theme` default to empty string. Bump plugin header version. | ~6 line edits |
| `src/utils/themes.js` | Add two new theme objects (`march-madness`, `world-cup`) following existing 13-key shape. | ~30 lines added |
| `src/components/SetupPanel.jsx` | Accept `variant` prop. Conditionally hide team-count-changing UI. Swap heading text. | ~5 conditional wrappers + 1 heading change |
| `src/App.jsx` | Accept `variant` prop. Lazy-init `participantNames` based on variant. Resolve theme: explicit > variant default > `'bw'`. Pass `variant` down to `SetupPanel`. | ~15 lines added/modified |
| `src/main.jsx` | Resolve `variant` from `options.variant \|\| container.dataset.variant \|\| ''`. Pass to `<App />`. Bump `window.BracketGenerator.version` to `'1.2.0'`. Remove the `\|\| 'bw'` theme fallback so `App` can resolve. | ~4 line edits |

---

## Task 1: WordPress Plugin (PHP shortcode)

**Files:**
- Modify: `wp-plugin/bracket-generator/bracket-generator.php`

**Why first:** PHP is the upstream end of the data flow. Doing it first means subsequent JS work can be tested end-to-end on the dev server once each downstream task lands.

- [ ] **Step 1: Read the current file**

Run: `cat wp-plugin/bracket-generator/bracket-generator.php`

Confirm: file header shows `Version: 1.1.0` near line 6; `shortcode_atts(['theme' => 'bw', 'ads' => ''], ...)` block exists; mount div has `data-theme` and `data-ads-mid-html`.

If the file diverges from this expectation, stop and re-check with user before continuing.

- [ ] **Step 2: Bump plugin header version**

Find the line `Version: 1.1.0` (in the PHP docblock at top of file). Change to:

```php
 * Version: 1.2.0
```

- [ ] **Step 3: Update `shortcode_atts` defaults + add whitelist**

Find this block (currently lines ~40-47):

```php
        $atts = shortcode_atts(
            [
                'theme' => 'bw',
                'ads'   => '', // comma-separated; valid values: 'top', 'mid', 'bottom'
            ],
            $atts,
            'bracket-generator'
        );
```

Replace with:

```php
        $atts = shortcode_atts(
            [
                'theme'   => '',  // empty string fallback so JS can distinguish "user didn't pick" from "user picked bw"
                'variant' => '',  // locked tournament variant: 'march-madness' | 'world-cup' | '' (generic)
                'ads'     => '',  // comma-separated; valid values: 'top', 'mid', 'bottom'
            ],
            $atts,
            'bracket-generator'
        );

        // Whitelist variant — invalid values fall back silently to generic.
        // Rationale: a typo in a shortcode shouldn't surface as an error to the
        // site visitor; the page just renders the generic tool instead.
        $valid_variants = ['', 'march-madness', 'world-cup'];
        $variant = in_array($atts['variant'], $valid_variants, true) ? $atts['variant'] : '';
```

- [ ] **Step 4: Emit `data-variant` on the mount div**

Find the mount div block (currently lines ~83-86):

```php
            <div id="<?php echo esc_attr($instance_id); ?>"
                 class="bracket-generator-mount"
                 data-theme="<?php echo esc_attr($atts['theme']); ?>"
                 data-ads-mid-html="<?php echo esc_attr($mid_html); ?>"></div>
```

Replace with:

```php
            <div id="<?php echo esc_attr($instance_id); ?>"
                 class="bracket-generator-mount"
                 data-theme="<?php echo esc_attr($atts['theme']); ?>"
                 data-variant="<?php echo esc_attr($variant); ?>"
                 data-ads-mid-html="<?php echo esc_attr($mid_html); ?>"></div>
```

- [ ] **Step 5: PHP syntax check**

Run: `php -l wp-plugin/bracket-generator/bracket-generator.php`

Expected output: `No syntax errors detected in wp-plugin/bracket-generator/bracket-generator.php`

If you get a syntax error, fix it and re-run before continuing.

- [ ] **Step 6: Suggest commit**

Propose this commit to the user:

```
feat(wp-plugin): add `variant` shortcode attribute + bump to 1.2.0

Adds `variant="march-madness"|"world-cup"` shortcode attribute with PHP-side
whitelist validation. Emits as `data-variant` on the mount div for the React
bundle to consume. Changes `theme` default from `'bw'` to `''` so the JS layer
can distinguish "user didn't pick a theme" from "user picked bw" — required
for variant default themes to apply correctly.

Refs: docs/superpowers/specs/2026-05-14-bracket-variants-design.md
```

Wait for user approval before running `git commit`.

---

## Task 2: Add new themes (themes.js)

**Files:**
- Modify: `src/utils/themes.js`

**Why second:** Pure data file, no dependencies, can't break anything. Doing this before `App.jsx` means by the time App needs to look up `THEMES['march-madness']`, the entry exists.

- [ ] **Step 1: Add `march-madness` and `world-cup` theme entries**

Find the closing `};` of the `THEMES` object (after the `interbasket` entry, currently around line 152). Before that closing brace, after the `interbasket` block, add:

```js
  'march-madness': {
    name: 'March Madness',
    bg: '#F4F5FB',          // very light navy tint
    cardBg: '#ffffff',
    cardBorder: '#1A2B5C',  // navy
    accent: '#FF8200',      // bright orange
    text: '#1A2B5C',
    textMuted: '#5A6678',
    winnerBg: '#FF8200',
    winnerText: '#ffffff',
    roundLabel: '#1A2B5C',
    connector: '#1A2B5C',
    headerBg: '#1A2B5C',
    preview: ['#F4F5FB', '#ffffff', '#FF8200', '#1A2B5C'],
  },
  'world-cup': {
    name: 'World Cup',
    bg: '#F0F7F2',          // very light green tint
    cardBg: '#ffffff',
    cardBorder: '#006633',  // pitch green
    accent: '#FFCC00',      // gold
    text: '#003D1F',
    textMuted: '#5A6E5C',
    winnerBg: '#FFCC00',
    winnerText: '#003D1F',  // gold bg needs dark text for contrast
    roundLabel: '#006633',
    connector: '#006633',
    headerBg: '#006633',
    preview: ['#F0F7F2', '#ffffff', '#FFCC00', '#006633'],
  },
```

The pattern follows `interbasket` (light bg + bold accent + dark chrome) rather than dark backgrounds — this matches the existing theme idiom and stays readable for printable brackets.

- [ ] **Step 2: Verify theme shape**

Each new theme entry must have exactly 13 keys: `name`, `bg`, `cardBg`, `cardBorder`, `accent`, `text`, `textMuted`, `winnerBg`, `winnerText`, `roundLabel`, `connector`, `headerBg`, `preview`.

Visually count the keys in each new entry. Confirm 13 each. If you missed `name` or any other key, ThemePicker label and bracket rendering will break.

- [ ] **Step 3: Suggest commit**

Propose this commit to the user:

```
feat(themes): add march-madness and world-cup theme presets

Adds two new theme entries following the existing 13-key shape. Themes
follow the interbasket pattern: light background tint + bold accent +
dark chrome (border/header/connector). MM uses navy+orange, WC uses
pitch green+gold. Both selectable from the standalone theme picker as
well as auto-applied by their respective variant.
```

Wait for user approval.

---

## Task 3: SetupPanel — accept variant prop, hide team-count UI, swap heading

**Files:**
- Modify: `src/components/SetupPanel.jsx`

**Why third:** Child component first. Adding the `variant` prop with a default value of `''` means even when `App.jsx` hasn't been updated yet to pass it, this component still works (variant is undefined → falsy → no behavior change). Forward-safe ordering.

- [ ] **Step 1: Add `variant` to props destructure**

Find the prop destructure block at the top of the component (currently lines ~7-27). Add `variant = ''` to the destructure list (anywhere is fine; keep it tidy by placing it near the bottom, after `adMidHtml`):

```jsx
export default function SetupPanel({
  participantNames,
  setParticipantNames,
  bracketType,
  setBracketType,
  showSeeds,
  setShowSeeds,
  printMargin,
  setPrintMargin,
  layout,
  setLayout,
  bracketStyle,
  setBracketStyle,
  participantsMode,
  setParticipantsMode,
  onGenerate,
  theme,
  themeName,
  setThemeName,
  adMidHtml,
  variant = '',
}) {
```

- [ ] **Step 2: Compute variant-derived constants near top of component body**

Right after the prop destructure closing `}) {`, before `const validCount = ...`, add:

```jsx
  // Variant lookup — drives heading text and whether team-count UI is locked.
  // Keep this list in sync with the whitelist in bracket-generator.php and the
  // VARIANT_CONFIG map in App.jsx.
  const VARIANT_TITLES = {
    'march-madness': 'Create Your March Madness Bracket',
    'world-cup': 'Create Your World Cup Bracket',
  };
  const isLockedVariant = variant in VARIANT_TITLES;
  const headingText = VARIANT_TITLES[variant] || 'Create Your Bracket';
```

- [ ] **Step 3: Swap the heading text**

Find the heading (currently around line 94-97):

```jsx
        <h2 className="text-3xl font-bold mb-2" style={{ color: theme.text }}>
          Create Your Bracket
        </h2>
```

Replace the literal heading string with the dynamic `{headingText}`:

```jsx
        <h2 className="text-3xl font-bold mb-2" style={{ color: theme.text }}>
          {headingText}
        </h2>
```

- [ ] **Step 4: Conditionally hide the Bracket Type toggle**

Find the Bracket Type block (currently around lines 105-127). It's the outer `<div className="flex flex-col gap-1">` that contains `<span>Type</span>` and a button group with `Single Elim` / `Double Elim`.

Wrap the entire outer `<div>...</div>` in `{!isLockedVariant && (`...`)}`. Concretely, change:

```jsx
        {/* Bracket Type */}
        <div className="flex flex-col gap-1">
          ...existing content unchanged...
        </div>
```

to:

```jsx
        {/* Bracket Type — hidden in variant mode (single-elim only) */}
        {!isLockedVariant && (
          <div className="flex flex-col gap-1">
            ...existing content unchanged...
          </div>
        )}
```

The existing inner content stays bit-identical.

- [ ] **Step 5: Conditionally hide the Quick Presets section + Custom Count input**

Find the Presets block (currently around lines 231-286). It starts with the comment `{/* Presets */}` and contains an outer `<div className="mb-4">` that wraps the "Quick Presets" label, the row of preset buttons, the row with the custom-count input + "Set" button, and the customCountError display.

Wrap the entire `<div className="mb-4">...</div>` in `{!isLockedVariant && (`...`)}`. Concretely, change:

```jsx
      {/* Presets */}
      <div className="mb-4">
        ...existing content unchanged...
      </div>
```

to:

```jsx
      {/* Presets + Custom Count — hidden in variant mode (team count is locked) */}
      {!isLockedVariant && (
        <div className="mb-4">
          ...existing content unchanged...
        </div>
      )}
```

- [ ] **Step 6: Conditionally hide the per-team "X" remove button**

Find the remove-team button inside the Draggable render function (currently around lines 391-401). It's the `<button onClick={() => removeParticipant(index)} ...>` block containing the SVG of two crossing lines.

Wrap the entire `<button>` element in `{!isLockedVariant && (`...`)}`. Concretely, change:

```jsx
                            <button
                              onClick={() => removeParticipant(index)}
                              ...all existing attributes unchanged...
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
```

to:

```jsx
                            {!isLockedVariant && (
                              <button
                                onClick={() => removeParticipant(index)}
                                ...all existing attributes unchanged...
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            )}
```

- [ ] **Step 7: Conditionally hide the "+ Add Participant" button**

Find the "+ Add Participant" button (currently around lines 412-422). It's a `<button onClick={addParticipant} ...>` with text content `+ Add Participant`.

Wrap the entire `<button>` element in `{!isLockedVariant && (`...`)}`. Concretely, change:

```jsx
            <button
              onClick={addParticipant}
              ...all existing attributes unchanged...
            >
              + Add Participant
            </button>
```

to:

```jsx
            {!isLockedVariant && (
              <button
                onClick={addParticipant}
                ...all existing attributes unchanged...
              >
                + Add Participant
              </button>
            )}
```

- [ ] **Step 8: Suggest commit**

Propose this commit to the user:

```
feat(setup-panel): hide team-count UI + swap heading when variant is set

Accepts new `variant` prop. When variant is 'march-madness' or 'world-cup':
- Hides Quick Presets buttons + Custom # of teams input
- Hides Bracket Type toggle (variants are single-elim only)
- Hides "+ Add Participant" button and per-team "X" remove buttons
- Swaps heading text from "Create Your Bracket" to the variant title

Generic mode (no variant) is unchanged: all controls visible. The variant
prop has a default of '' so this is backward-compatible if App hasn't been
updated yet to pass it.
```

Wait for user approval.

---

## Task 4: App — accept variant prop, lazy init participantNames, resolve theme

**Files:**
- Modify: `src/App.jsx`

**Why fourth:** Middle layer. Needs `themes.js` (Task 2) for variant-default theme lookup, and needs `SetupPanel` (Task 3) to accept `variant`. With both downstream pieces in place, App can wire them together.

- [ ] **Step 1: Add `VARIANT_CONFIG` constant near the top of the file**

Find this block at the top of the file (currently lines 10-13):

```jsx
const DEFAULT_PARTICIPANTS = [
  'Team 1', 'Team 2', 'Team 3', 'Team 4',
  'Team 5', 'Team 6', 'Team 7', 'Team 8',
];
```

Directly after the `DEFAULT_PARTICIPANTS` declaration, add:

```jsx
// Variant config — drives forced team count and default theme.
// Keep keys in sync with the PHP whitelist (bracket-generator.php) and the
// VARIANT_TITLES map in SetupPanel.jsx.
const VARIANT_CONFIG = {
  'march-madness': { teamCount: 64, defaultTheme: 'march-madness' },
  'world-cup': { teamCount: 32, defaultTheme: 'world-cup' },
};
```

- [ ] **Step 2: Add `variant` to props destructure + change `initialTheme` default**

Find the function signature (currently line 19):

```jsx
export default function App({ initialTheme = 'bw', feedbackUrl = null, adMidHtml = null }) {
```

Change to:

```jsx
export default function App({ initialTheme = '', variant = '', feedbackUrl = null, adMidHtml = null }) {
```

Two changes here: added `variant = ''`, and changed `initialTheme` default from `'bw'` to `''` (so empty values flow through to variant-aware resolution).

- [ ] **Step 3: Resolve initial theme based on variant**

Right after the function signature opens (`export default function App(...) {`), before the existing `const [title] = useState(...)`, add:

```jsx
  // Theme resolution: explicit `initialTheme` (from shortcode `theme` attr) > variant default > app default 'bw'.
  // The PHP layer defaults `theme` to empty string so we can distinguish here.
  const variantConfig = VARIANT_CONFIG[variant] || null;
  const resolvedInitialTheme = initialTheme || variantConfig?.defaultTheme || 'bw';
```

- [ ] **Step 4: Use resolved theme in state init**

Find this line (currently line 24):

```jsx
  const [themeName, setThemeName] = useState(initialTheme);
```

Change to:

```jsx
  const [themeName, setThemeName] = useState(resolvedInitialTheme);
```

- [ ] **Step 5: Lazy-initialize `participantNames` based on variant**

Find this line (currently line 31):

```jsx
  const [participantNames, setParticipantNames] = useState(DEFAULT_PARTICIPANTS);
```

Change to:

```jsx
  // Lazy initializer (callback form) runs ONCE per mount. This prevents user-typed
  // team names from being reset on StrictMode double-invoke or parent re-renders.
  // For variant mode, returns a fresh array of "Team N" placeholders sized to the
  // variant's locked count; otherwise returns the 8-team default.
  const [participantNames, setParticipantNames] = useState(() => {
    if (variantConfig) {
      return Array.from({ length: variantConfig.teamCount }, (_, i) => `Team ${i + 1}`);
    }
    return DEFAULT_PARTICIPANTS;
  });
```

- [ ] **Step 6: Pass `variant` down to SetupPanel**

Find the `<SetupPanel ... />` invocation (currently around lines 114-134). Add `variant={variant}` to the prop list. Place it tidily near the bottom of the prop list (after `adMidHtml`):

```jsx
          <SetupPanel
            participantNames={participantNames}
            setParticipantNames={setParticipantNames}
            bracketType={bracketType}
            setBracketType={setBracketType}
            showSeeds={showSeeds}
            setShowSeeds={setShowSeeds}
            printMargin={printMargin}
            setPrintMargin={setPrintMargin}
            layout={layout}
            setLayout={setLayout}
            bracketStyle={bracketStyle}
            setBracketStyle={setBracketStyle}
            participantsMode={participantsMode}
            setParticipantsMode={setParticipantsMode}
            onGenerate={handleGenerate}
            theme={theme}
            themeName={themeName}
            setThemeName={setThemeName}
            adMidHtml={adMidHtml}
            variant={variant}
          />
```

- [ ] **Step 7: Suggest commit**

Propose this commit to the user:

```
feat(app): accept variant prop, lazy-init team list, resolve theme priority

Adds `variant` prop. When variant is 'march-madness' or 'world-cup':
- Lazy-initializes participantNames to 64 or 32 "Team N" placeholders
  using useState's callback form, so user-typed names survive
  StrictMode double-invoke and parent re-renders.
- Resolves initial theme as: explicit theme prop > variant's default
  theme > app default 'bw'. The initialTheme default also changes
  from 'bw' to '' so the empty value can flow through to variant
  resolution; the final fallback ('bw') is preserved.
- Passes variant down to SetupPanel for UI gating.

Generic mode unchanged: 8 default participants, theme falls back to 'bw'.
```

Wait for user approval.

---

## Task 5: main.jsx — read variant from DOM/options, pass to App, bump bundle version

**Files:**
- Modify: `src/main.jsx`

**Why fifth:** Topmost layer in the JS chain. By now, downstream consumers (App, SetupPanel, themes) are all ready. main.jsx just plugs in the new data source.

- [ ] **Step 1: Resolve variant in `mount()`**

Find the theme resolution line inside `mount()` (currently line 57):

```jsx
  const theme = options.theme || container.dataset.theme || 'bw';
```

Change to:

```jsx
  // Theme resolution defers to App.jsx — empty string flows through so variant
  // default themes can take effect. App resolves the final theme as:
  // explicit theme > variant default > 'bw'.
  const theme = options.theme || container.dataset.theme || '';
  // Variant: locked tournament preset, currently 'march-madness' | 'world-cup' | ''.
  // Validated upstream in PHP; the React app re-checks via VARIANT_CONFIG lookup,
  // so an unknown value here harmlessly falls back to generic.
  const variant = options.variant || container.dataset.variant || '';
```

- [ ] **Step 2: Pass `variant` to `<App />`**

Find the `<App />` render line (currently line 72):

```jsx
        <App initialTheme={theme} feedbackUrl={feedbackUrl} adMidHtml={adMidHtml} />
```

Change to:

```jsx
        <App initialTheme={theme} variant={variant} feedbackUrl={feedbackUrl} adMidHtml={adMidHtml} />
```

- [ ] **Step 3: Bump `window.BracketGenerator.version`**

Find this line (currently line 81):

```jsx
  window.BracketGenerator = { version: '1.0.0', mount };
```

Change to:

```jsx
  // Bumped to match plugin header (bracket-generator.php). This is the only
  // client-side signal for detecting a stale bundle vs new PHP — checked manually
  // post-deploy via `window.BracketGenerator.version` in the browser console.
  window.BracketGenerator = { version: '1.2.0', mount };
```

- [ ] **Step 4: Suggest commit**

Propose this commit to the user:

```
feat(main): resolve variant from data attribute, pass to App, bump bundle version

- Reads `options.variant || container.dataset.variant || ''` in mount(),
  mirroring how theme is resolved. The PHP shortcode emits data-variant.
- Removes the '|| "bw"' fallback for theme so empty string can flow to
  App for variant-aware theme resolution.
- Bumps window.BracketGenerator.version from '1.0.0' to '1.2.0' to match
  the plugin header. Provides a manual client-side cache-mismatch check
  (verify in browser console post-deploy).
```

Wait for user approval.

---

## Task 6: Build the bundle

**Files:**
- Generates: `wp-plugin/bracket-generator/dist/bracket-generator.js` + `.css`

**Why sixth:** Each preceding task was code-only. Now we compile and confirm zero errors.

- [ ] **Step 1: Run the plugin build**

Run: `npm run build:plugin`

Expected output ends with something like `✓ built in <N>ms`. Look for these specific failure modes and surface them:

- `Cannot find module './utils/themes'` → likely a typo in themes.js syntax (a stray comma, missing brace). The build error message should also point to the line.
- `'variant' is not defined` → main.jsx may not have declared the variant constant before using it in the JSX. Re-check Step 1 of Task 5.
- `Unexpected token` in SetupPanel → likely an unbalanced JSX conditional wrap from Task 3. Find the offending block by file:line in the error and fix the matching parens.

If you see `pnpm: command not found` or similar, use `npm` (this project uses npm per package.json).

If you see warnings but `✓ built` at the end, that's success. Surface warnings to the user as informational.

- [ ] **Step 2: Verify dist files were emitted**

Run: `ls -la wp-plugin/bracket-generator/dist/`

Expected: `bracket-generator.js` and `bracket-generator.css` both exist, with a recent `mtime` (modified within the last few minutes — proves this build wrote them, not an old build).

- [ ] **Step 3: Spot-check the bundle contains expected strings**

Run: `grep -c 'march-madness' wp-plugin/bracket-generator/dist/bracket-generator.js`

Expected: a positive integer (the bundle should contain the literal string `march-madness` because it's a theme key and a VARIANT_CONFIG key). If the count is `0`, something didn't compile in — investigate before continuing.

Run: `grep -c "Create Your March Madness Bracket" wp-plugin/bracket-generator/dist/bracket-generator.js`

Expected: at least `1` (the heading text from SetupPanel made it into the bundle).

Run: `grep -c "1\\.2\\.0" wp-plugin/bracket-generator/dist/bracket-generator.js`

Expected: at least `1` (the bundle version bump from main.jsx).

If any of these greps return 0, stop and re-check the relevant task's edits.

- [ ] **Step 4: Suggest commit for the rebuilt dist files**

Propose this commit to the user:

```
build(plugin): rebuild bundle with v1.2.0 variant support

Rebuilds wp-plugin/bracket-generator/dist/* with the bundled variant
support code from src/. Bundle now contains:
- VARIANT_CONFIG with march-madness (64) and world-cup (32)
- THEMES.march-madness and THEMES.world-cup
- "Create Your March Madness Bracket" / "Create Your World Cup Bracket" headings
- window.BracketGenerator.version = '1.2.0'
```

Wait for user approval.

---

## Task 7: Manual verification (asks user)

**Files:**
- Temporarily modify (then revert): `index.html` (dev mount point — to add `data-variant` for testing)

**Why seventh:** With code + build complete, this confirms the runtime behavior. Per user's standing instruction, the implementer does NOT run `npm run dev` itself — Wai Hoow runs it and visually checks. The implementer's job is to give clear test instructions and an expected/actual checklist.

**How variant testing works in dev:** The dev server (`npm run dev`) auto-mounts the bracket to `<div id="bracket-root">` in `index.html`. To test a variant, edit that div to add `data-variant="..."`, save the file, and Vite hot-reloads the page. To test another variant, change the value and save again. After all testing, revert `index.html` to its original `<div id="bracket-root"></div>` (no attributes).

- [ ] **Step 1: Ask user to start dev server**

Ask user: "Please run `npm run dev` and confirm the local URL it prints (typically `http://localhost:5173`). Let me know when the dev server is up."

- [ ] **Step 2: Test A — Generic mode regression check**

Ask user:

> **Test A: Generic mode (regression).** With `index.html` unchanged (`<div id="bracket-root"></div>` has no `data-variant`), open `http://localhost:5173/` in a browser.
>
> Expected: heading reads "Create Your Bracket", 8 default participants visible, Quick Presets buttons (4/8/16/32) visible, custom-count input visible, bracket-type toggle (Single/Double) visible, "+ Add Participant" button visible at bottom of team list, "X" remove buttons visible on each team row.
>
> Reply: "Test A: pass" or describe what differs.

Wait for user reply before continuing.

- [ ] **Step 3: Test B — March Madness variant**

Ask user:

> **Test B: March Madness variant.** Edit `index.html` line 10 from:
> ```html
> <div id="bracket-root"></div>
> ```
> to:
> ```html
> <div id="bracket-root" data-variant="march-madness"></div>
> ```
> Save the file. Vite will hot-reload the page automatically.
>
> Expected:
> - Heading reads **"Create Your March Madness Bracket"**
> - 64 participant rows visible (scroll down — long list)
> - Quick Presets buttons are **HIDDEN**
> - Custom # of teams input is **HIDDEN**
> - Bracket Type toggle (Single/Double) is **HIDDEN**
> - "+ Add Participant" button is **HIDDEN** (no button at bottom of team list)
> - "X" remove buttons next to each team row are **HIDDEN**
> - Theme is navy/orange (page background is light navy tint, bracket cards have navy borders, accent buttons are orange, headers are dark navy)
> - Theme picker dropdown is still visible — try changing it to another theme (e.g., `bw`) and confirm theme changes but all the hidden controls stay hidden
>
> Reply: "Test B: pass" or list what differs.

Wait for user reply.

- [ ] **Step 4: Test C — World Cup variant**

Ask user:

> **Test C: World Cup variant.** In `index.html` change the value:
> ```html
> <div id="bracket-root" data-variant="world-cup"></div>
> ```
> Save. Vite hot-reloads.
>
> Expected:
> - Heading reads **"Create Your World Cup Bracket"**
> - 32 participant rows visible
> - Same hidden-UI set as MM (no presets, no custom count, no type toggle, no + Add, no X remove)
> - Theme is green/gold (page light green tint, gold accent on winner badges, green chrome on borders/headers, dark green text)
>
> Reply: "Test C: pass" or list what differs.

Wait for user reply.

- [ ] **Step 5: Test D — Invalid variant falls back to generic**

Ask user:

> **Test D: Invalid variant fallback.** In `index.html` change the value:
> ```html
> <div id="bracket-root" data-variant="nonsense"></div>
> ```
> Save. Vite hot-reloads.
>
> Expected: page looks IDENTICAL to Test A (generic mode). Heading is "Create Your Bracket", 8 default participants, all controls visible. No JavaScript error in browser console.
>
> Open browser dev tools → Console tab → confirm no red errors.
>
> Reply: "Test D: pass" or describe.

Wait for user reply.

- [ ] **Step 6: Test E — Explicit theme override on variant**

Ask user:

> **Test E: Theme override on variant.** In `index.html` change line 10 to:
> ```html
> <div id="bracket-root" data-variant="march-madness" data-theme="bw"></div>
> ```
> Save. Vite hot-reloads.
>
> Expected:
> - Heading reads "Create Your March Madness Bracket" (variant heading still applies)
> - 64 participant rows (variant team-count lock still applies)
> - Hidden UI set is still hidden (variant lockdowns still apply)
> - **Theme is black-and-white** (`bw`), NOT navy/orange — page is white, accent is black. The explicit `theme="bw"` wins over the variant's default theme.
>
> Reply: "Test E: pass — theme overrides AND locks held" or describe.

Wait for user reply.

- [ ] **Step 7: Test F — Bundle version check**

Ask user:

> **Test F: Bundle version.** Open browser dev tools → Console tab. Type:
> ```js
> window.BracketGenerator.version
> ```
> Press Enter.
>
> Expected output: `'1.2.0'`
>
> Reply: report the value you see.

Wait for user reply. If they report `'1.0.0'`, the bundle wasn't rebuilt — go back to Task 6.

- [ ] **Step 8: Test G — Full user flow on variant (state retention check)**

Ask user:

> **Test G: Full flow on MM variant.** Set `index.html` back to:
> ```html
> <div id="bracket-root" data-variant="march-madness"></div>
> ```
> Save. Wait for hot-reload.
>
> Now: type custom names in about 5-10 of the 64 input fields (e.g., "Duke", "Kentucky", "Kansas"). Click "Generate Bracket (64 participants)" at the bottom.
>
> Expected: bracket renders with your typed names plus default "Team N" for the rest.
>
> Click "Back to Setup" in the top-left.
>
> Expected after Back to Setup:
> - Team count is STILL 64
> - All custom names you typed are STILL there (not reset to "Team 1...Team 64")
> - Hidden-UI set is STILL hidden (no presets reappeared, no + Add reappeared)
> - Theme is STILL navy/orange
>
> This test specifically validates the `useState` lazy initializer — without it, going back to setup could reset participantNames.
>
> Reply: "Test G: pass — state held across Generate/Back round-trip" or describe.

Wait for user reply.

- [ ] **Step 9: Revert `index.html`**

After all tests pass, restore `index.html` line 10 to:

```html
<div id="bracket-root"></div>
```

This is the production-shipped state. Save the file. Confirm via:

```bash
git diff index.html
```

Expected: empty output (no diff). If diff shows changes, manually revert with:

```bash
git checkout -- index.html
```

- [ ] **Step 10: If any test failed, debug**

If any test reported a failure:
1. Note which test (A-G) and what behavior diverged
2. Map to responsible task: heading text → Task 3 Step 3; team count → Task 4 Step 5; variant data flow → Task 5 Step 1; theme resolution → Task 4 Step 3-4; hidden UI → Task 3 Steps 4-7
3. Re-read the relevant code, fix, re-run `npm run build:plugin`, ask user to re-run the failed test specifically
4. Do NOT proceed to packaging until all 7 tests pass and `index.html` is reverted to its original state

- [ ] **Step 11: If all tests pass, proceed to packaging**

No commit needed in this task. If you fixed anything during Step 10, commit that fix separately with an appropriate message.

---

## Task 8: Package the plugin zip

**Files:**
- Generates: `bracket-generator.zip` (or whatever the existing packaging script outputs)

**Why eighth:** End state. Stuart needs a zip file to upload to interbasket.net.

- [ ] **Step 1: Check how the project currently builds the zip**

Run: `cat package.json | grep -A 1 '"scripts"'`

Look for any script named `package`, `zip`, `pack`, `build:zip`, or similar. If one exists, use it.

If no zip script exists, fall back to manual packaging:

```bash
cd wp-plugin
rm -f bracket-generator.zip
zip -r bracket-generator.zip bracket-generator/ -x '*.DS_Store' '*.map'
ls -la bracket-generator.zip
cd ..
```

Expected: `bracket-generator.zip` file is created in `wp-plugin/`. `ls -la` shows it's ~300-400KB (similar to the v1.1.0 zip the user mentioned: 339.5K).

- [ ] **Step 2: Verify zip contents**

Run: `unzip -l wp-plugin/bracket-generator.zip` (path may differ depending on Step 1 result)

Expected: the zip contains:
- `bracket-generator/bracket-generator.php`
- `bracket-generator/dist/bracket-generator.js`
- `bracket-generator/dist/bracket-generator.css`

It should NOT contain:
- `.DS_Store` files
- Source `.map` files
- Anything from `src/`

If extraneous files are present, remove them from the source tree or update the zip command's exclusion list.

- [ ] **Step 3: Final status report to user**

Report:

```
Plugin packaged: <path-to-zip> (<size>)
Version: 1.2.0
Variants added: march-madness (64 teams), world-cup (32 teams)
All 7 manual tests passed.

To deploy:
1. Upload <path-to-zip> via WP plugin admin → Plugins → Add New → Upload Plugin → Replace existing
2. Create WP page "/bracket-generator/march-madness/" with body: [bracket-generator variant="march-madness"]
3. Create WP page "/bracket-generator/world-cup/" with body: [bracket-generator variant="world-cup"]
4. Cache verification: open both new pages in incognito, hard-refresh, check
   window.BracketGenerator.version === '1.2.0' in browser console. If you see
   '1.0.0', purge Cloudflare/CDN cache for /wp-content/plugins/bracket-generator/dist/*.
```

- [ ] **Step 4: Final commit**

Propose this commit to the user:

```
chore(release): package bracket-generator v1.2.0 with variant support

Final zip artifact for client deployment. Variants:
- march-madness: 64 teams, single elim, navy/orange theme
- world-cup: 32 teams, single elim, green/gold theme

Generic [bracket-generator] shortcode unchanged.
```

Wait for user approval.

---

## Self-review notes (for the implementer reading this plan)

This plan was self-reviewed against the spec before being saved. Findings:

1. **Spec coverage** — every "Components affected" row in the spec maps to a task here (Task 1 = PHP; Task 2 = themes.js; Task 3 = SetupPanel; Task 4 = App; Task 5 = main.jsx; Tasks 6-8 = build/test/package).

2. **Spec gap fix applied during planning** — the user-facing behavior table originally didn't list "+ Add Participant" or "X remove buttons" but those are part of "removing the choice to add number of teams" per Stuart's request. Spec was updated before this plan was written to include them. Task 3 Steps 6 and 7 implement the corresponding hiding.

3. **No placeholders** — every code block contains actual code, every command contains actual command syntax. No "TBD," no "implement appropriate error handling," no "similar to Task N — see above."

4. **Naming consistency check** — `VARIANT_CONFIG` (App.jsx) and `VARIANT_TITLES` (SetupPanel.jsx) are intentionally different maps (different concerns: count+theme vs heading text). Both use kebab-case variant keys (`'march-madness'`, `'world-cup'`). PHP whitelist uses the same kebab-case keys. The keys must stay consistent across all three locations — drift here means a working PHP shortcode that silently fails in JS, or a JS variant lookup that misses the PHP whitelist. Each map declaration carries an inline "keep in sync with" comment to flag this for future edits.

5. **Theme precedence implemented in App.jsx** — matches spec section "Theme precedence." Implementation chain: PHP defaults theme to `''` → main.jsx removes the `'bw'` fallback → App resolves with `initialTheme || variantConfig?.defaultTheme || 'bw'`. The final `'bw'` fallback is in App because that's where the resolution chain terminates.

6. **TDD deviation acknowledged** — the writing-plans skill's template uses test-first steps, but this project has no test framework and the user explicitly says "verification means asking user to test." Per the user-instruction-priority in CLAUDE.md, the plan substitutes manual verification (Task 7) for automated tests. Each task still has a verification gate (PHP syntax check, build success, grep for expected strings in bundle) before commit.

7. **Commit discipline** — per user's "NEVER commit unless I ask," every `commit` step is phrased as "suggest this commit to the user." Implementer asks; user approves; only then `git commit`.

8. **Index.html test pattern** — Task 7 uses temporary `index.html` edits + Vite hot-reload for variant testing in dev mode, rather than console DOM manipulation. Cleaner, no XSS-looking patterns, and `index.html` is reverted at end of testing (Step 9).

9. **Test G is non-obvious but load-bearing** — it specifically validates the lazy `useState` initializer pattern from Task 4 Step 5. Without lazy init, the Generate→Back round-trip would reset participantNames because `useState(defaultValue)` re-runs `defaultValue` evaluation on every render. With lazy init, the callback runs once per mount. If a future refactor strips lazy init, Test G is what catches it.
