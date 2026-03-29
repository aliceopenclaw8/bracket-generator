import { useState, useRef, useEffect } from 'react';
import { THEMES } from '../utils/themes';

export default function ThemePicker({ themeName, setThemeName, currentTheme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        style={{
          background: currentTheme.cardBg,
          border: `1px solid ${currentTheme.cardBorder}`,
          color: currentTheme.text,
        }}
      >
        <div className="flex gap-1">
          {currentTheme.preview.map((c, i) => (
            <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <span>{currentTheme.name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 rounded-xl p-2 z-50 shadow-2xl min-w-[200px]"
          style={{ background: currentTheme.cardBg, border: `1px solid ${currentTheme.cardBorder}` }}
        >
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => { setThemeName(key); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left cursor-pointer"
              style={{
                background: key === themeName ? t.accent + '22' : 'transparent',
                color: currentTheme.text,
              }}
            >
              <div className="flex gap-1">
                {t.preview.map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ background: c }} />
                ))}
              </div>
              <span className="font-medium">{t.name}</span>
              {key === themeName && (
                <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={currentTheme.accent} strokeWidth="3">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
