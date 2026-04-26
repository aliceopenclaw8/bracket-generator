import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

/**
 * Mount the bracket generator into a given container.
 *
 * @param {HTMLElement} container - The DOM element to mount into.
 * @param {Object} [options] - Optional overrides.
 * @param {string} [options.theme] - Theme name. Falls back to container.dataset.theme.
 * @param {string} [options.feedbackUrl] - Feedback link URL. Falls back to container.dataset.feedbackUrl.
 * @returns {import('react-dom/client').Root} The React root, in case the caller needs to unmount later.
 */
export function mount(container, options = {}) {
  if (!container) {
    throw new Error('BracketGenerator.mount: container is required');
  }
  const theme = options.theme || container.dataset.theme || 'bw';
  const feedbackUrl =
    options.feedbackUrl ||
    container.dataset.feedbackUrl ||
    'mailto:interbasketmedia@gmail.com?subject=Bracket%20Generator%20problem';

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App initialTheme={theme} feedbackUrl={feedbackUrl} />
    </React.StrictMode>
  );
  return root;
}

// Expose globally for the WP plugin's inline script to call.
if (typeof window !== 'undefined') {
  window.BracketGenerator = { mount };
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
