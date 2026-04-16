import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// A4 landscape dimensions in inches (297mm × 210mm)
const PAGE_W = 11.693;
const PAGE_H = 8.268;
// A4 at 300 DPI for print-ready PNG
const A4_PX_W = 3508;
const A4_PX_H = 2480;

export default function ExportButtons({ bracketRef, title, theme, printMargin = 1 }) {
  const overrideStyles = (el, newStyles) => {
    if (!el) return null;
    const orig = {};
    for (const k of Object.keys(newStyles)) {
      orig[k] = el.style[k];
      el.style[k] = newStyles[k];
    }
    return () => { for (const k of Object.keys(orig)) el.style[k] = orig[k]; };
  };

  // Minimal capture prep — ONLY strip cosmetic chrome.
  // The bracket on screen already has the correct layout, connectors, and sizing.
  // Changing transform/padding/minHeight during capture breaks everything.
  const prepareCapture = () => {
    const restoreFns = [];
    const runRestores = () => restoreFns.forEach(fn => {
      try { fn(); } catch (e) { console.error('restore failed:', e); }
    });

    try {
      const containerEl = bracketRef.current?.querySelector('.bracket-container');
      const headerEl = bracketRef.current?.querySelector('.bracket-export-header');

      // Hide bracket header (title bar) — saves vertical space
      const r1 = overrideStyles(headerEl, { display: 'none' });
      if (r1) restoreFns.push(r1);

      // Remove border and rounded corners — no outline in export
      const r2 = overrideStyles(containerEl, { border: 'none', borderRadius: '0' });
      if (r2) restoreFns.push(r2);

      if (restoreFns.length === 0) return null;
      return runRestores;
    } catch (e) {
      console.error('prepareCapture failed:', e);
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
        throw new Error('html2canvas returned empty canvas');
      }
      // Place on A4 canvas at 300 DPI with margins
      const marginPx = Math.round(printMargin * 300);
      const maxW = A4_PX_W - marginPx * 2;
      const maxH = A4_PX_H - marginPx * 2;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const imgW = Math.round(canvas.width * ratio);
      const imgH = Math.round(canvas.height * ratio);

      const a4 = document.createElement('canvas');
      a4.width = A4_PX_W;
      a4.height = A4_PX_H;
      const ctx = a4.getContext('2d');
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, A4_PX_W, A4_PX_H);
      const x = Math.round((A4_PX_W - imgW) / 2);
      const widthLimited = (maxW / canvas.width) < (maxH / canvas.height);
      const y = widthLimited ? marginPx : Math.round(marginPx + (maxH - imgH) / 2);
      ctx.drawImage(canvas, x, y, imgW, imgH);

      const link = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '_')}.png`;
      link.href = a4.toDataURL('image/png');
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
      const canvas = await html2canvas(bracketRef.current, {
        backgroundColor: theme.bg,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('html2canvas returned empty canvas');
      }
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'a4' });
      const margin = printMargin;
      const maxW = PAGE_W - margin * 2;
      const maxH = PAGE_H - margin * 2;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const x = (PAGE_W - imgW) / 2;
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
