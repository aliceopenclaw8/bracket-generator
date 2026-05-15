<?php
/**
 * Plugin Name: Bracket Generator
 * Plugin URI: https://github.com/aliceopenclaw8/bracket-generator
 * Description: Embed an interactive tournament bracket generator on any page via the [bracket-generator] shortcode. Supports brand-matched theme variants and optional ad slots.
 * Version: 1.2.1
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

// class_exists guard — prevents fatal "Cannot redeclare" if WP loads this
// file twice (caching plugins, must-use loaders, MultiSite edge cases).
if (!class_exists('Bracket_Generator_Plugin')) {

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

        self::$instance_count++;
        $instance_id = 'bracket-root-' . self::$instance_count;

        if (!self::$assets_enqueued) {
            $this->enqueue_assets();
            self::$assets_enqueued = true;
        }

        $ad_positions = array_map('trim', explode(',', $atts['ads']));
        $show_top    = in_array('top', $ad_positions, true);
        $show_bottom = in_array('bottom', $ad_positions, true);
        // Mid slot is rendered inside the React tree (not in this PHP wrapper)
        // because its position depends on app state (above Participants in setup
        // view, above Export buttons in result view). We pre-resolve [gard] here
        // so the React component receives final HTML, then stash it on a data
        // attribute. esc_attr() handles the round-trip — quotes, newlines, and
        // <script> bodies all survive; the browser auto-decodes on dataset read.
        //
        // IMPORTANT: the receiving end (src/components/AdSlot.jsx) injects this
        // HTML via innerHTML and re-executes its <script> tags. Do not change
        // esc_attr() here to a stricter encoder without coordinating with the
        // React side — would break ad rendering silently.
        $show_mid    = in_array('mid', $ad_positions, true);
        $mid_html    = $show_mid ? $this->safe_gard_html() : '';

        ob_start();
        ?>
        <div class="bracket-generator-wrapper">
            <?php if ($show_top): ?>
                <div class="bracket-ad bracket-ad-top">
                    <?php echo $this->safe_gard_html(); ?>
                </div>
            <?php endif; ?>

            <div id="<?php echo esc_attr($instance_id); ?>"
                 class="bracket-generator-mount"
                 data-theme="<?php echo esc_attr($atts['theme']); ?>"
                 data-variant="<?php echo esc_attr($variant); ?>"
                 data-ads-mid-html="<?php echo esc_attr($mid_html); ?>"></div>

            <?php if ($show_bottom): ?>
                <div class="bracket-ad bracket-ad-bottom">
                    <?php echo $this->safe_gard_html(); ?>
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
                        var failEl = document.getElementById(id);
                        if (failEl) {
                            // Build the fallback DOM using safe APIs (textContent + style props),
                            // not innerHTML, to satisfy strict CSP / XSS-lint policies. Content is
                            // entirely static, but textContent keeps that fact obvious to auditors.
                            while (failEl.firstChild) { failEl.removeChild(failEl.firstChild); }
                            var failMsg = document.createElement('p');
                            failMsg.style.textAlign = 'center';
                            failMsg.style.padding = '2rem';
                            failMsg.style.color = '#666';
                            failMsg.textContent = 'The bracket tool failed to load. Please refresh the page.';
                            failEl.appendChild(failMsg);
                        }
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
        $plugin_dir = plugin_dir_path(__FILE__);

        // Use file modification time as the asset version so every rebuild
        // changes the ?ver= query param. WP appends ?ver=$ver to the asset
        // URL — that URL is the cache key for browsers, LiteSpeed, and any
        // CDN in front of WP (e.g., Cloudflare). Without filemtime we ship
        // a new bundle but the URL stays identical, so caches keep serving
        // the old bundle until TTL expires (hours to days). filemtime makes
        // every rebuild auto-cache-bust through the entire stack.
        // Falls back to the plugin Version if the file isn't readable.
        $js_path  = $plugin_dir . 'dist/bracket-generator.js';
        $css_path = $plugin_dir . 'dist/bracket-generator.css';
        $js_ver   = file_exists($js_path)  ? (string) filemtime($js_path)  : '1.1.0';
        $css_ver  = file_exists($css_path) ? (string) filemtime($css_path) : '1.1.0';

        wp_enqueue_script(
            'bracket-generator',
            $plugin_url . 'dist/bracket-generator.js',
            [],
            $js_ver,
            true // load in footer
        );

        wp_enqueue_style(
            'bracket-generator',
            $plugin_url . 'dist/bracket-generator.css',
            [],
            $css_ver
        );
    }

    /**
     * Vite outputs ES modules. WP emits <script type="text/javascript" src="...">
     * by default — naive insertion of `type="module"` produces two `type`
     * attributes, and the browser uses the first one (text/javascript), which
     * causes `import.meta` and other ESM-only syntax to throw SyntaxError.
     *
     * Strip any existing type attribute first via regex, then add type="module".
     * Handles both the WP-emitted `type="text/javascript"` form and a future
     * type-less form.
     */
    public function add_module_type($tag, $handle) {
        if ($handle === 'bracket-generator') {
            $tag = preg_replace('/\stype=([\'"])[^\'"]*\1/', '', $tag);
            return str_replace(' src=', ' type="module" src=', $tag);
        }
        return $tag;
    }

    /**
     * Resolve [gard] safely. Returns rendered ad markup if the GARD plugin
     * is active, empty string otherwise. Without this guard, do_shortcode()
     * returns the literal string '[gard]' when the plugin is missing, which
     * leaks visible junk text to the rendered page (especially bad if
     * Stuart deactivates GARD for license/upgrade reasons and forgets).
     */
    private function safe_gard_html() {
        if (!shortcode_exists('gard')) {
            if (function_exists('error_log')) {
                error_log('[bracket-generator] [gard] shortcode not registered; ad slot suppressed');
            }
            return '';
        }
        return do_shortcode('[gard]');
    }
}

new Bracket_Generator_Plugin();

}
