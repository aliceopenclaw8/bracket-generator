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
}

new Bracket_Generator_Plugin();

}
