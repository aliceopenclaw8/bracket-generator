import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// US Letter landscape dimensions in inches
const PAGE_W = 11;
const PAGE_H = 8.5;

export default function ExportButtons({ bracketRef, title, theme, printMargin = 1 }) {
  // Helper: override inline styles and return a restore function.
  const overrideStyles = (el, newStyles) => {
    if (!el) return null;
    const orig = {};
    for (const k of Object.keys(newStyles)) {
      orig[k] = el.style[k];
      el.style[k] = newStyles[k];
    }
    return () => { for (const k of Object.keys(orig)) el.style[k] = orig[k]; };
  };

  const prepareCapture = () => {
    const restoreFns = [];
    const runRestores = () => restoreFns.forEach(fn => {
      try { fn(); } catch (e) { console.error('Failed to restore DOM state:', e); }
    });

    try {
      const scaledEl = bracketRef.current?.querySelector('[data-auto-scale]');
      const overflowEl = bracketRef.current?.querySelector('.bracket-container');
      const headerEl = bracketRef.current?.querySelector('.bracket-export-header');
      const refEl = bracketRef.current;
      const parentEl = refEl?.parentElement;

      // Shrink-wrap bracket container to eliminate whitespace in capture
      const r1 = overrideStyles(overflowEl, { width: 'fit-content', overflow: 'visible' });
      if (r1) restoreFns.push(r1);

      // Remove width constraints so wide brackets aren't clipped
      const r2 = overrideStyles(refEl, { width: 'fit-content' });
      if (r2) restoreFns.push(r2);
      const r3 = overrideStyles(parentEl, { maxWidth: 'none', width: 'fit-content' });
      if (r3) restoreFns.push(r3);

      // Remove auto-scale transform for true-size capture
      const r4 = overrideStyles(scaledEl, {
        transform: 'none', marginRight: '0px', marginBottom: '0px', opacity: '1',
      });
      if (r4) restoreFns.push(r4);

      // Hide bracket header to avoid bloating canvas dimensions
      const r5 = overrideStyles(headerEl, { display: 'none' });
      if (r5) restoreFns.push(r5);

      // Remove bracket container visual chrome (border, rounded corners) for clean capture
      const containerEl = bracketRef.current?.querySelector('.bracket-container');
      const r6 = overrideStyles(containerEl, {
        border: 'none',
        borderRadius: '0',
      });
      if (r6) restoreFns.push(r6);

      // Remove content area padding (the div with class p-6 inside bracket-container)
      const contentAreaEl = containerEl?.querySelector('.p-6');
      if (contentAreaEl) {
        const r7 = overrideStyles(contentAreaEl, { padding: '8px' });
        if (r7) restoreFns.push(r7);
      } else {
        // Fallback: try bracket-scroll class
        const scrollEl = containerEl?.querySelector('.bracket-scroll');
        if (scrollEl) {
          const r7 = overrideStyles(scrollEl, { padding: '8px' });
          if (r7) restoreFns.push(r7);
        }
      }

      // Remove artificial minHeight from flex containers (causes tall captures
      // that waste horizontal page space when PDF scales to fit height)
      const minHeightEls = bracketRef.current.querySelectorAll('[style]');
      minHeightEls.forEach(el => {
        if (el.style.minHeight && el.style.minHeight !== '') {
          const orig = el.style.minHeight;
          restoreFns.push(() => { el.style.minHeight = orig; });
          el.style.minHeight = 'auto';
        }
      });

      if (restoreFns.length === 0) return null;
      return runRestores;
    } catch (e) {
      // Roll back any mutations that succeeded before the throw
      console.error('prepareCapture failed mid-mutation, rolling back:', e);
      runRestores();
      throw e;
    }
  };

  const handlePNG = async () => {
    if (!bracketRef.current) return;
    let restore = null;
    try {
      restore = prepareCapture();
      const canvas = await html2canvas(bracketRef.current, {
        backgroundColor: theme.bg,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('html2canvas returned empty canvas — likely memory exhaustion');
      }
      const link = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
      alert(`Failed to export as PNG: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      if (restore) restore();
    }
  };

  const handlePDF = async () => {
    if (!bracketRef.current) return;
    let restore = null;
    try {
      restore = prepareCapture();

      // Estimate legibility AFTER prepareCapture so we measure the actual capture state
      const usableW = PAGE_W - printMargin * 2;
      if (usableW > 0) {
        const previewEl = bracketRef.current.querySelector('[data-auto-scale]') || bracketRef.current;
        const naturalW = previewEl.scrollWidth;
        if (naturalW > 0) {
          const effectiveFontPt = (42 / (naturalW * 3)) * usableW * 72;
          if (effectiveFontPt < 5) {
            const ok = window.confirm(
              'This bracket is very large and may be difficult to read when printed on a single page. Continue anyway?'
            );
            if (!ok) return;
          }
        }
      }

      const canvas = await html2canvas(bracketRef.current, {
        backgroundColor: theme.bg,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('html2canvas returned empty canvas — likely memory exhaustion');
      }
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });
      const margin = printMargin;
      const maxW = PAGE_W - margin * 2;
      const maxH = PAGE_H - margin * 2;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const x = (PAGE_W - imgW) / 2;
      // Wide brackets (width-limited): top-align so vertical space isn't wasted.
      // Tall brackets (height-limited): vertically center to balance white space.
      const widthLimited = (maxW / canvas.width) < (maxH / canvas.height);
      const y = widthLimited ? margin : margin + (maxH - imgH) / 2;
      pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
      pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert(`Failed to export as PDF: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      if (restore) restore();
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handlePNG}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 cursor-pointer"
        style={{ background: theme.accent, color: theme.winnerText }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7,10 12,15 17,10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        PNG
      </button>
      <button
        onClick={handlePDF}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 cursor-pointer"
        style={{ background: theme.accent, color: theme.winnerText }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
        </svg>
        PDF
      </button>
    </div>
  );
}
