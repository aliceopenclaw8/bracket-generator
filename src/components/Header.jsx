import { useState } from 'react';

export default function Header({ title, setTitle, theme }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  const handleSave = () => {
    setTitle(editValue.trim() || 'Tournament Bracket');
    setEditing(false);
  };

  return (
    <header
      className="border-b px-6 py-4 flex items-center gap-4"
      style={{ background: theme.headerBg, borderColor: theme.cardBorder }}
    >
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
    </header>
  );
}
