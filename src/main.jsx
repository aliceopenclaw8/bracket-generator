import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

/**
 * Render-time crash backstop. If any descendant throws (e.g., html2canvas
 * blowup during export, malformed bracket state, drag-drop edge case),
 * React would otherwise unmount the whole tree and leave a blank container
 * with no signal of what failed. Class component because hooks can't
 * implement getDerivedStateFromError / componentDidCatch.
 */
class BracketGeneratorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('BracketGenerator crashed:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666', fontFamily: 'system-ui, sans-serif' }}>
          <p>Something went wrong with the bracket tool.</p>
          {this.props.feedbackUrl && (
            <p>
              <a href={this.props.feedbackUrl} style={{ color: '#666', textDecoration: 'underline' }}>
                Report this issue
              </a>
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Mount the bracket generator into a given container.
 *
 * @param {HTMLElement} container - The DOM element to mount into.
 * @param {Object} [options] - Optional overrides.
 * @param {string} [options.theme] - Theme name. Falls back to container.dataset.theme.
 * @param {string} [options.feedbackUrl] - Feedback link URL. Falls back to container.dataset.feedbackUrl.
 * @param {string} [options.adMidHtml] - Pre-rendered AdSense HTML for the mid slot. Falls back to container.dataset.adsMidHtml.
 * @param {string} [options.introHtml] - Admin-authored intro copy (sanitized server-side). Falls back to container.dataset.introHtml.
 * @returns {import('react-dom/client').Root} The React root, in case the caller needs to unmount later.
 */
export function mount(container, options = {}) {
  if (!container) {
    throw new Error('BracketGenerator.mount: container is required');
  }
  // Theme resolution defers to App.jsx — empty string flows through so variant
  // default themes can take effect. App resolves the final theme as:
  // explicit theme > variant default > 'bw'.
  const theme = options.theme || container.dataset.theme || '';
  // Variant: locked tournament preset, currently 'march-madness' | 'world-cup' | ''.
  // Validated upstream in PHP; the React app re-checks via VARIANT_CONFIG lookup,
  // so an unknown value here harmlessly falls back to generic.
  const variant = options.variant || container.dataset.variant || '';
  const feedbackUrl =
    options.feedbackUrl ||
    container.dataset.feedbackUrl ||
    'mailto:interbasketmedia@gmail.com?subject=Bracket%20Generator%20problem';
  // Pre-rendered AdSense markup baked into a data attribute by the WP plugin
  // (esc_attr-encoded server-side, browser auto-decodes on dataset read). Null
  // when "mid" is not in the shortcode's ads="..." list — AdSlot then renders
  // nothing, costing zero DOM nodes.
  const adMidHtml = options.adMidHtml || container.dataset.adsMidHtml || null;
  // Admin-authored intro copy from the shortcode's inner content. Already
  // sanitized server-side with wp_kses_post() (see bracket-generator.php), so the
  // markup is trusted by the time it reaches React. Null when the shortcode has
  // no inner content — SetupPanel then renders no intro paragraph.
  const introHtml = options.introHtml || container.dataset.introHtml || null;

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <BracketGeneratorErrorBoundary feedbackUrl={feedbackUrl}>
        <App initialTheme={theme} variant={variant} feedbackUrl={feedbackUrl} adMidHtml={adMidHtml} introHtml={introHtml} />
      </BracketGeneratorErrorBoundary>
    </React.StrictMode>
  );
  return root;
}

// Expose globally for the WP plugin's inline script to call.
if (typeof window !== 'undefined') {
  // Bumped to match plugin header (bracket-generator.php). This is the only
  // client-side signal for detecting a stale bundle vs new PHP — checked manually
  // post-deploy via `window.BracketGenerator.version` in the browser console.
  window.BracketGenerator = { version: '1.2.1', mount };
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
