import { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// US Letter landscape dimensions in inches (11" × 8.5")
const PAGE_W = 11;
const PAGE_H = 8.5;
// US Letter at 300 DPI for print-ready PNG. Output page resolution stays at
// 300 DPI even when the captured bracket is rasterized at scale=2 (200 DPI) —
// jsPDF/the browser will upscale on render. Output page DPI and capture DPI
// are independent concerns.
const LETTER_PX_W = 3300;
const LETTER_PX_H = 2550;

// Performance notes:
// - 32-team double-sided brackets render a complex DOM (62+ team slots, many
//   connectors). Export takes 30-60s on typical hardware even with scale=2.
// - Line-style brackets use SVG path connectors which can stress
//   rasterization libraries. If line-style at high team counts hangs
//   indefinitely, that's a known limitation tracked for v1.1 (a deeper fix
//   would be SVG-native PDF generation, not raster).
// - Scale lowered from 3 → 2: cuts canvas pixel count by 56% (3² → 2² = 9 → 4)
//   for ~2-3× faster export. 200 DPI is still print-quality at Letter size
//   (2200×1700 px on the captured bracket, well above visible-detail
//   thresholds for printed brackets).
export default function ExportButtons({ bracketRef, title, theme, printMargin = 0 }) {
  // Tracks which export (if any) is in progress so the buttons can show a
  // spinner + "Exporting…" label and disable both buttons. Without this,
  // users assumed the export was broken during the 30s-4min delay and
  // clicked again, queueing duplicate exports and worsening the hang.
  const [exporting, setExporting] = useState(null); // null | 'png' | 'pdf'

  // WYSIWYG: capture bracketRef exactly as rendered. Never mutate the live DOM
  // before capture — hiding the header or changing sizes triggers
  // AutoScaleWrapper's ResizeObserver mid-capture and the bracket rescales.
  const captureOptions = {
    backgroundColor: theme.bg,
    scale: 2,
    useCORS: true,
    logging: false,
  };

  const handlePNG = async () => {
    setExporting('png');
    try {
      // Capture .bracket-container directly, not the wrapper — wrapper includes
      // mx-auto gutters which break Letter aspect and cause letterboxing in export.
      const target = bracketRef.current?.querySelector('.bracket-container');
      if (!target) throw new Error('Bracket not ready — try regenerating');
      const canvas = await html2canvas(target, captureOptions);
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Rendered canvas is empty');
      }
      // Place on US Letter canvas at 300 DPI with margins
      const marginPx = Math.round(printMargin * 300);
      const maxW = LETTER_PX_W - marginPx * 2;
      const maxH = LETTER_PX_H - marginPx * 2;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const imgW = Math.round(canvas.width * ratio);
      const imgH = Math.round(canvas.height * ratio);

      const page = document.createElement('canvas');
      page.width = LETTER_PX_W;
      page.height = LETTER_PX_H;
      const ctx = page.getContext('2d');
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, LETTER_PX_W, LETTER_PX_H);
      const x = Math.round((LETTER_PX_W - imgW) / 2);
      const y = Math.round((LETTER_PX_H - imgH) / 2);
      ctx.drawImage(canvas, x, y, imgW, imgH);

      const link = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '_')}.png`;
      link.href = page.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
      alert(`Failed to export as PNG: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const handlePDF = async () => {
    setExporting('pdf');
    try {
      const target = bracketRef.current?.querySelector('.bracket-container');
      if (!target) throw new Error('Bracket not ready — try regenerating');
      const canvas = await html2canvas(target, captureOptions);
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Rendered canvas is empty');
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
      const y = (PAGE_H - imgH) / 2;
      pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
      pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert(`Failed to export as PDF: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const isExporting = exporting !== null;

  return (
    <div className="flex gap-2">
      <button
        onClick={handlePNG}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 cursor-pointer disabled:opacity-60 disabled:cursor-wait disabled:hover:scale-100"
        style={{ background: theme.accent, color: theme.winnerText }}
      >
        {exporting === 'png' ? (
          <>
            <Spinner />
            Exporting…
          </>
        ) : (
          <>
            <DownloadIcon />
            PNG
          </>
        )}
      </button>
      <button
        onClick={handlePDF}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 cursor-pointer disabled:opacity-60 disabled:cursor-wait disabled:hover:scale-100"
        style={{ background: theme.accent, color: theme.winnerText }}
      >
        {exporting === 'pdf' ? (
          <>
            <Spinner />
            Exporting…
          </>
        ) : (
          <>
            <PdfIcon />
            PDF
          </>
        )}
      </button>
    </div>
  );
}

// Inline icon components — keep file self-contained, no separate icon imports.
// Spinner uses Tailwind's animate-spin utility (built-in v4 keyframes), which
// is safer than inline @keyframes since the bracket plugin runs inside WP
// where global @keyframes might collide with theme styles.
function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
      <path d="M22 12a10 10 0 0 1-10 10" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7,10 12,15 17,10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );
}
