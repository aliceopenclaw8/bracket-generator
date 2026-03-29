import { useState, useRef } from 'react';

export default function Header({ title, setTitle, logo, setLogo, theme }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const fileRef = useRef(null);

  const handleSave = () => {
    setTitle(editValue.trim() || 'Tournament Bracket');
    setEditing(false);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogo(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <header
      className="border-b px-6 py-4 flex items-center gap-4"
      style={{ background: theme.headerBg, borderColor: theme.cardBorder }}
    >
      <div
        className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden"
        style={{ background: theme.accent + '22', border: `2px dashed ${theme.accent}44` }}
        onClick={() => fileRef.current?.click()}
        title="Upload logo"
      >
        {logo ? (
          <img src={logo} alt="Logo" className="w-full h-full object-cover" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            className="text-2xl font-bold bg-transparent border-b-2 outline-none w-full"
            style={{ color: theme.text, borderColor: theme.accent }}
          />
        ) : (
          <h1
            className="text-2xl font-bold cursor-pointer truncate hover:opacity-80 transition-opacity"
            onClick={() => { setEditValue(title); setEditing(true); }}
            style={{ color: theme.text }}
            title="Click to edit"
          >
            {title}
          </h1>
        )}
      </div>

      {logo && (
        <button
          onClick={() => setLogo(null)}
          className="text-xs opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
          style={{ color: theme.textMuted }}
        >
          Remove logo
        </button>
      )}
    </header>
  );
}
