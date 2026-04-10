import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function ExportButtons({ bracketRef, title, theme, printMargin = 1 }) {
  const prepareCapture = () => {
    const scaledEl = bracketRef.current?.querySelector('[data-auto-scale]');
    const overflowEl = bracketRef.current?.querySelector('.bracket-container');
    let restore = null;
    if (scaledEl) {
      const origTransform = scaledEl.style.transform;
      const origMarginR = scaledEl.style.marginRight;
      const origMarginB = scaledEl.style.marginBottom;
      const origOpacity = scaledEl.style.opacity;
      scaledEl.style.transform = 'none';
      scaledEl.style.marginRight = '0px';
      scaledEl.style.marginBottom = '0px';
      scaledEl.style.opacity = '1';
      // Temporarily remove overflow:hidden so unscaled content isn't clipped
      if (overflowEl) overflowEl.style.overflow = 'visible';
      restore = () => {
        scaledEl.style.transform = origTransform;
        scaledEl.style.marginRight = origMarginR;
        scaledEl.style.marginBottom = origMarginB;
        scaledEl.style.opacity = origOpacity;
        if (overflowEl) overflowEl.style.overflow = '';
      };
    }
    return restore;
  };

  const handlePNG = async () => {
    if (!bracketRef.current) return;
    const restore = prepareCapture();
    try {
      const canvas = await html2canvas(bracketRef.current, {
        backgroundColor: theme.bg,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert('Failed to export as PNG. Please try again.');
    } finally {
      if (restore) restore();
    }
  };

  const handlePDF = async () => {
    if (!bracketRef.current) return;
    const restore = prepareCapture();
    try {
      const canvas = await html2canvas(bracketRef.current, {
        backgroundColor: theme.bg,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = printMargin;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const x = (pageW - imgW) / 2;
      const y = (pageH - imgH) / 2;
      pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
      pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
    } catch {
      alert('Failed to export as PDF. Please try again.');
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
