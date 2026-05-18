import { useState, useCallback, useRef, useEffect } from 'react';
import { generateSingleElimination, generateDoubleElimination, advanceWinner, unadvanceWinner } from './utils/bracketLogic';
import { THEMES } from './utils/themes';
import SetupPanel from './components/SetupPanel';
import BracketView from './components/BracketView';
import ExportButtons from './components/ExportButtons';
import ThemePicker from './components/ThemePicker';
import AdSlot from './components/AdSlot';

const DEFAULT_PARTICIPANTS = [
  'Team 1', 'Team 2', 'Team 3', 'Team 4',
  'Team 5', 'Team 6', 'Team 7', 'Team 8',
];

// Three sources of truth must agree on valid variant keys: this map, the PHP
// whitelist in bracket-generator.php, and VARIANT_TITLES in SetupPanel.jsx.
// A key present here but missing from the others silently renders generic.
const VARIANT_CONFIG = {
  'march-madness': { teamCount: 64, defaultTheme: 'march-madness' },
  'world-cup': { teamCount: 32, defaultTheme: 'world-cup' },
};

function createParticipants(names) {
  return names.map((name, i) => ({ id: `p-${i}`, name, seed: i + 1 }));
}

export default function App({ initialTheme = '', variant = '', feedbackUrl = null, adMidHtml = null, introHtml = null }) {
  // Theme resolution: explicit `initialTheme` (from shortcode `theme` attr) > variant default > app default 'bw'.
  // The PHP layer defaults `theme` to empty string so we can distinguish here.
  const variantConfig = VARIANT_CONFIG[variant] || null;
  const resolvedInitialTheme = initialTheme || variantConfig?.defaultTheme || 'bw';

  // Title drives the export filename. Currently a fixed value (no UI to edit
  // it), but kept as state so adding per-bracket naming later is a one-line
  // switch from constant to controlled input.
  const [title] = useState('Tournament Bracket');
  const [themeName, setThemeName] = useState(resolvedInitialTheme);
  const [bracketType, setBracketType] = useState('single');
  // Variant mode is single-elim only per spec ("forced Single"). Deriving the
  // effective value here keeps the lock at the code level instead of relying on
  // the SetupPanel toggle being hidden — defends against any future code path
  // that might set bracketType to 'double' in variant mode.
  const effectiveBracketType = variantConfig ? 'single' : bracketType;
  const [showSeeds, setShowSeeds] = useState(true);
  const [printMargin, setPrintMargin] = useState(0);
  const [layout, setLayout] = useState('standard');
  // Variants are locked to double-sided: the centered logo and symmetric draw
  // only make visual sense in that layout. Deriving effectiveLayout here (same
  // pattern as effectiveBracketType above) keeps the lock at the code level so
  // no code path can bypass it by setting `layout` state directly.
  const effectiveLayout = variantConfig ? 'double-sided' : layout;
  const [bracketStyle, setBracketStyle] = useState('boxed');
  const [participantsMode, setParticipantsMode] = useState('add-teams');
  // Lazy initializer (callback form) runs ONCE per mount. This prevents user-typed
  // team names from being reset on StrictMode double-invoke or parent re-renders.
  // For variant mode, returns a fresh array of "Team N" placeholders sized to the
  // variant's locked count; otherwise returns the 8-team default.
  const [participantNames, setParticipantNames] = useState(() => {
    if (variantConfig) {
      return Array.from({ length: variantConfig.teamCount }, (_, i) => `Team ${i + 1}`);
    }
    return DEFAULT_PARTICIPANTS;
  });
  const [bracket, setBracket] = useState(null);
  const [doubleBracket, setDoubleBracket] = useState(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const bracketRef = useRef(null);

  const theme = THEMES[themeName] || THEMES.bw;

  // Auto-scroll on first generate. Required when the tool is embedded mid-page
  // (e.g., below SEO copy on the WP host site) — users would otherwise sit at
  // the toolbar without seeing the bracket.
  //
  // Double-rAF: AutoScaleWrapper (in BracketView) runs a ResizeObserver async
  // after the React commit. Scrolling synchronously when isGenerated flips true
  // targets a position that's about to change. First rAF batches with the next
  // paint; second rAF lands after the ResizeObserver-triggered re-layout
  // completes. Without this, large brackets land hundreds of pixels off.
  useEffect(() => {
    if (!isGenerated) return;
    let frame1, frame2;
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        bracketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return () => {
      cancelAnimationFrame(frame1);
      if (frame2) cancelAnimationFrame(frame2);
    };
  }, [isGenerated]);

  const handleGenerate = useCallback(() => {
    let participants;
    if (participantsMode === 'blank') {
      if (participantNames.length < 2) return;
      // Blank mode: generate bracket slots with empty names
      participants = participantNames.map((_, i) => ({ id: `p-${i}`, name: '', seed: i + 1 }));
    } else {
      participants = createParticipants(participantNames.filter(n => n.trim()));
      if (participants.length < 2) return;
    }

    if (effectiveBracketType === 'single') {
      const result = generateSingleElimination(participants);
      setBracket(result);
      setDoubleBracket(null);
    } else {
      const result = generateDoubleElimination(participants);
      setDoubleBracket(result);
      setBracket(null);
    }
    setIsGenerated(true);
  }, [participantNames, effectiveBracketType, participantsMode]);

  // Click semantics for a team slot in a match:
  //  - no winner yet                  → advance the clicked team
  //  - winner is the OTHER team       → switch the winner (advanceWinner overwrites)
  //  - winner IS the clicked team     → un-advance (mis-click recovery)
  // findMatchWinnerId locates the match across a flat list of rounds so we can
  // tell which of the three cases applies before mutating.
  const findMatchWinnerId = (rounds, matchId) => {
    for (const round of rounds) {
      for (const match of round) {
        if (match.id === matchId) return match.winner?.id ?? null;
      }
    }
    return null;
  };

  const handleAdvanceWinner = useCallback((matchId, team, bracketSection) => {
    if (effectiveBracketType === 'single' && bracket) {
      // If the clicked team is already the winner, undo; otherwise advance/switch.
      const isUndo = findMatchWinnerId(bracket.rounds, matchId) === team.id;
      const newRounds = isUndo
        ? unadvanceWinner(bracket.rounds, matchId, team)
        : advanceWinner(bracket.rounds, matchId, team);
      setBracket({ ...bracket, rounds: newRounds });
    } else if (effectiveBracketType === 'double' && doubleBracket) {
      if (bracketSection === 'winners') {
        const isUndo = findMatchWinnerId(doubleBracket.winnersRounds, matchId) === team.id;
        const newRounds = isUndo
          ? unadvanceWinner(doubleBracket.winnersRounds, matchId, team)
          : advanceWinner(doubleBracket.winnersRounds, matchId, team);
        setDoubleBracket({ ...doubleBracket, winnersRounds: newRounds });
      } else if (bracketSection === 'losers') {
        const isUndo = findMatchWinnerId(doubleBracket.losersRounds, matchId) === team.id;
        const newRounds = isUndo
          ? unadvanceWinner(doubleBracket.losersRounds, matchId, team)
          : advanceWinner(doubleBracket.losersRounds, matchId, team);
        setDoubleBracket({ ...doubleBracket, losersRounds: newRounds });
      } else if (bracketSection === 'grandFinals') {
        const isUndo = findMatchWinnerId([doubleBracket.grandFinals], matchId) === team.id;
        const newGF = isUndo
          ? unadvanceWinner([doubleBracket.grandFinals], matchId, team)
          : advanceWinner([doubleBracket.grandFinals], matchId, team);
        setDoubleBracket({ ...doubleBracket, grandFinals: newGF[0] });
      }
    }
  }, [bracket, doubleBracket, effectiveBracketType]);

  const handleReset = useCallback(() => {
    setBracket(null);
    setDoubleBracket(null);
    setIsGenerated(false);
  }, []);

  return (
    // Setup screen uses a plain white background so the embedded tool blends into
    // the host WP page instead of looking like a distinctly tinted box. Once a
    // bracket is generated, the themed background returns. Export still captures
    // theme.bg (it reads .bracket-container, not this outer div) — unaffected.
    <div style={{ background: isGenerated ? theme.bg : '#ffffff', color: theme.text, minHeight: '100vh' }}
         className="transition-colors duration-300">
      <div className="max-w-screen-2xl mx-auto px-4 pb-12">
        {!isGenerated ? (
          <SetupPanel
            participantNames={participantNames}
            setParticipantNames={setParticipantNames}
            bracketType={bracketType}
            setBracketType={setBracketType}
            showSeeds={showSeeds}
            setShowSeeds={setShowSeeds}
            printMargin={printMargin}
            setPrintMargin={setPrintMargin}
            layout={layout}
            setLayout={setLayout}
            bracketStyle={bracketStyle}
            setBracketStyle={setBracketStyle}
            participantsMode={participantsMode}
            setParticipantsMode={setParticipantsMode}
            onGenerate={handleGenerate}
            theme={theme}
            themeName={themeName}
            setThemeName={setThemeName}
            adMidHtml={adMidHtml}
            variant={variant}
            introHtml={introHtml}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                onClick={handleReset}
                data-testid="back-to-setup"
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                style={{
                  background: theme.cardBg,
                  border: `1px solid ${theme.cardBorder}`,
                  color: theme.text,
                }}
              >
                Back to Setup
              </button>
              <ThemePicker themeName={themeName} setThemeName={setThemeName} currentTheme={theme} />
              <button
                onClick={() => setShowSeeds(!showSeeds)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                style={{
                  background: showSeeds ? theme.accent + '22' : theme.cardBg,
                  border: `1px solid ${showSeeds ? theme.accent : theme.cardBorder}`,
                  color: showSeeds ? theme.accent : theme.text,
                }}
              >
                {showSeeds ? 'Seeded' : 'Unseeded'}
              </button>
            </div>

            <div ref={bracketRef}>
              <BracketView
                bracket={bracket}
                doubleBracket={doubleBracket}
                bracketType={effectiveBracketType}
                bracketStyle={bracketStyle}
                layout={effectiveLayout}
                theme={theme}
                title={title}
                onAdvanceWinner={handleAdvanceWinner}
                showSeeds={showSeeds}
                variant={variant}
              />
            </div>

            <AdSlot html={adMidHtml} position="mid" />

            <div className="flex justify-center mt-6 no-print">
              <ExportButtons bracketRef={bracketRef} title={title} theme={theme} printMargin={printMargin} />
            </div>

            {feedbackUrl && (
              <div className="no-print flex justify-end mt-4">
                <a
                  href={feedbackUrl}
                  className="text-sm"
                  style={{ color: theme.accent, textDecoration: 'underline' }}
                >
                  Provide feedback
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
