import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ThemePicker from './ThemePicker';
import { shuffleArray } from '../utils/shuffle';

export default function SetupPanel({
  participantNames,
  setParticipantNames,
  bracketType,
  setBracketType,
  showSeeds,
  setShowSeeds,
  printMargin,
  setPrintMargin,
  layout,
  setLayout,
  bracketStyle,
  setBracketStyle,
  participantsMode,
  setParticipantsMode,
  onGenerate,
  theme,
  themeName,
  setThemeName,
}) {
  const validCount = participantNames.filter(n => n.trim()).length;

  // Reset layout to standard if participant count drops below threshold for double-sided
  useEffect(() => {
    if (participantNames.length < 8 && layout === 'double-sided') {
      setLayout('standard');
    }
  }, [participantNames.length, layout, setLayout]);

  const handleNameChange = (index, value) => {
    const newNames = [...participantNames];
    newNames[index] = value;
    setParticipantNames(newNames);
  };

  const addParticipant = () => {
    setParticipantNames([...participantNames, '']);
  };

  const removeParticipant = (index) => {
    if (participantNames.length <= 2) return;
    setParticipantNames(participantNames.filter((_, i) => i !== index));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = [...participantNames];
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setParticipantNames(items);
  };

  const presets = [4, 8, 16, 32];
  const [customCount, setCustomCount] = useState('');
  const [customCountError, setCustomCountError] = useState('');

  const handlePreset = (count) => {
    const names = [];
    for (let i = 0; i < count; i++) {
      names.push(participantNames[i] || `Team ${i + 1}`);
    }
    setParticipantNames(names);
    setCustomCount('');
    setCustomCountError('');
  };

  const handleCustomCount = () => {
    const count = parseInt(customCount, 10);
    if (!count || count < 2 || count > 128) {
      setCustomCountError('Enter a number between 2 and 128');
      return;
    }
    setCustomCountError('');
    const names = [];
    for (let i = 0; i < count; i++) {
      names.push(participantNames[i] || `Team ${i + 1}`);
    }
    setParticipantNames(names);
  };

  const handleRandomize = () => {
    setParticipantNames(shuffleArray(participantNames));
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2" style={{ color: theme.text }}>
          Setup Your Tournament
        </h2>
        <p style={{ color: theme.textMuted }}>
          Add participants, choose bracket type, and customize the look
        </p>
      </div>

      {/* Compact Options Row */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        {/* Bracket Type */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: theme.textMuted }}>Type</span>
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${theme.cardBorder}` }}>
            {[
              { value: 'single', label: 'Single Elim' },
              { value: 'double', label: 'Double Elim' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setBracketType(opt.value)}
                className="px-2 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: bracketType === opt.value ? theme.accent : theme.cardBg,
                  color: bracketType === opt.value ? theme.winnerText : theme.text,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bracket Style */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: theme.textMuted }}>Style</span>
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${theme.cardBorder}` }}>
            {[
              { value: 'boxed', label: 'Boxed' },
              { value: 'line', label: 'Line' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setBracketStyle(opt.value)}
                className="px-2 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: bracketStyle === opt.value ? theme.accent : theme.cardBg,
                  color: bracketStyle === opt.value ? theme.winnerText : theme.text,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Layout (SE only, >= 8 teams) */}
        {bracketType === 'single' && participantNames.length >= 8 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: theme.textMuted }}>Layout</span>
            <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${theme.cardBorder}` }}>
              {[
                { value: 'standard', label: 'Standard' },
                { value: 'double-sided', label: 'Double-Sided' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setLayout(opt.value)}
                  className="px-2 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    background: layout === opt.value ? theme.accent : theme.cardBg,
                    color: layout === opt.value ? theme.winnerText : theme.text,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Seed Display */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: theme.textMuted }}>Seeds</span>
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${theme.cardBorder}` }}>
            {[
              { value: true, label: 'Seeded' },
              { value: false, label: 'Unseeded' },
            ].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setShowSeeds(opt.value)}
                className="px-2 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: showSeeds === opt.value ? theme.accent : theme.cardBg,
                  color: showSeeds === opt.value ? theme.winnerText : theme.text,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Print Margin */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: theme.textMuted }}>Margin</span>
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${theme.cardBorder}` }}>
            {[
              { value: 0, label: 'None' },
              { value: 0.5, label: '0.5 in' },
              { value: 1, label: '1 in' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setPrintMargin(opt.value)}
                className="px-2 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: printMargin === opt.value ? theme.accent : theme.cardBg,
                  color: printMargin === opt.value ? theme.winnerText : theme.text,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: theme.textMuted }}>Theme</span>
          <ThemePicker themeName={themeName} setThemeName={setThemeName} currentTheme={theme} />
        </div>
      </div>

      {/* Presets */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2" style={{ color: theme.textMuted }}>
          Quick Presets
        </label>
        <div className="flex gap-2">
          {presets.map(n => (
            <button
              key={n}
              onClick={() => handlePreset(n)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 cursor-pointer"
              style={{
                background: participantNames.length === n ? theme.accent + '33' : theme.cardBg,
                border: `1px solid ${participantNames.length === n ? theme.accent : theme.cardBorder}`,
                color: theme.text,
              }}
            >
              {n} Teams
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            type="number"
            min="2"
            max="128"
            value={customCount}
            onChange={(e) => { setCustomCount(e.target.value); setCustomCountError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomCount()}
            placeholder="Custom # of teams"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: theme.cardBg,
              border: `1px solid ${theme.cardBorder}`,
              color: theme.text,
            }}
          />
          <button
            onClick={handleCustomCount}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 cursor-pointer"
            style={{
              background: theme.cardBg,
              border: `1px solid ${theme.cardBorder}`,
              color: theme.text,
            }}
          >
            Set
          </button>
        </div>
        {customCountError && (
          <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{customCountError}</p>
        )}
      </div>

      {/* Participants Section */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium" style={{ color: theme.textMuted }}>
            Participants ({participantNames.length})
          </label>
          {/* Blank / Add Teams Toggle */}
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${theme.cardBorder}` }}>
            {[
              { value: 'blank', label: 'Blank' },
              { value: 'add-teams', label: 'Add Teams' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setParticipantsMode(opt.value)}
                className="px-3 py-1 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: participantsMode === opt.value ? theme.accent : theme.cardBg,
                  color: participantsMode === opt.value ? theme.winnerText : theme.text,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {participantsMode === 'blank' && (
          <p className="text-sm mb-3" style={{ color: theme.textMuted }}>
            Blank bracket &mdash; {participantNames.length} empty slots
          </p>
        )}

        {participantsMode === 'add-teams' && (
          <>
            <div className="flex items-center justify-end mb-2 gap-3">
              <button
                onClick={handleRandomize}
                className="text-xs px-3 py-1 rounded-full font-medium transition-all hover:scale-105 cursor-pointer"
                style={{
                  background: theme.accent + '15',
                  color: theme.accent,
                  border: `1px solid ${theme.accent}44`,
                }}
              >
                Randomize
              </button>
              <span className="text-xs" style={{ color: theme.textMuted }}>
                Drag to reorder seeds
              </span>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="participants">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {participantNames.map((name, index) => (
                      <Draggable key={`p-${index}`} draggableId={`p-${index}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-center gap-2 rounded-lg p-1 transition-shadow"
                            style={{
                              ...provided.draggableProps.style,
                              background: snapshot.isDragging ? theme.accent + '22' : theme.cardBg,
                              border: `1px solid ${snapshot.isDragging ? theme.accent : theme.cardBorder}`,
                            }}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="flex items-center justify-center w-8 h-8 rounded cursor-grab shrink-0"
                              style={{ color: theme.textMuted }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="9" cy="6" r="1.5" />
                                <circle cx="15" cy="6" r="1.5" />
                                <circle cx="9" cy="12" r="1.5" />
                                <circle cx="15" cy="12" r="1.5" />
                                <circle cx="9" cy="18" r="1.5" />
                                <circle cx="15" cy="18" r="1.5" />
                              </svg>
                            </div>
                            <span
                              className="text-xs font-mono w-6 text-center shrink-0"
                              style={{ color: theme.accent }}
                            >
                              {index + 1}
                            </span>
                            <input
                              value={name}
                              onChange={(e) => handleNameChange(index, e.target.value)}
                              placeholder={`Team ${index + 1}`}
                              className="flex-1 bg-transparent outline-none text-sm py-2 px-2"
                              style={{ color: theme.text }}
                            />
                            <button
                              onClick={() => removeParticipant(index)}
                              className="w-8 h-8 flex items-center justify-center rounded hover:opacity-100 opacity-40 transition-opacity shrink-0 cursor-pointer"
                              style={{ color: theme.text }}
                              disabled={participantNames.length <= 2}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <button
              onClick={addParticipant}
              className="w-full mt-2 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.01] cursor-pointer"
              style={{
                background: theme.cardBg,
                border: `1px dashed ${theme.cardBorder}`,
                color: theme.textMuted,
              }}
            >
              + Add Participant
            </button>
          </>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={participantsMode === 'add-teams' ? validCount < 2 : participantNames.length < 2}
        className="w-full py-3 rounded-xl text-lg font-bold transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style={{
          background: theme.accent,
          color: theme.winnerText,
        }}
      >
        {participantsMode === 'blank'
          ? `Generate Blank Bracket (${participantNames.length} slots)`
          : `Generate Bracket (${validCount} participants)`
        }
      </button>
    </div>
  );
}
