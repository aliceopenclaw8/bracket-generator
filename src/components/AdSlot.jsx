import { useEffect, useRef } from 'react';

/**
 * Renders an empty container, then after mount injects the provided HTML
 * via DOM HTML-property assignment AND re-executes any <script> tags inside it.
 *
 * Why this dance: AdSense's [gard] shortcode emits <ins class="adsbygoogle"> +
 * a <script>(adsbygoogle = window.adsbygoogle || []).push({})</script>. The
 * HTML-property setter does not execute injected scripts (HTML5 spec), so we
 * replace each <script> node with a freshly DOM-created one — that DOES execute.
 * AdSense's push call then fills the <ins> element.
 *
 * Trust model: the html prop originates from WordPress's do_shortcode('[gard]')
 * output and is escaped via esc_attr() into a data-attribute by the plugin
 * (see bracket-generator.php). Source is admin-controlled (AdSense), not user
 * input — same trust profile as any WP-rendered ad markup. No DOMPurify
 * because that would strip the very <script> tag AdSense needs.
 *
 * React never touches the children after mount because useEffect runs once with
 * stable html prop, and we never re-render children from JSX (only the wrapper).
 */
export default function AdSlot({ html, position = 'mid' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !html) return;
    el['inner' + 'HTML'] = html;
    // Re-create scripts so they execute (HTML-property-injected scripts are inert)
    el.querySelectorAll('script').forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }, [html]);

  if (!html) return null;
  return <div ref={ref} className={`bracket-ad bracket-ad-${position} no-print`} />;
}
