import { useState, useCallback, useRef } from 'react';
import { generateSingleElimination, generateDoubleElimination, advanceWinner } from './utils/bracketLogic';
import { THEMES } from './utils/themes';
import Header from './components/Header';
import SetupPanel from './components/SetupPanel';
import BracketView from './components/BracketView';
import ExportButtons from './components/ExportButtons';
import ThemePicker from './components/ThemePicker';

const DEFAULT_PARTICIPANTS = [
  'Team 1', 'Team 2', 'Team 3', 'Team 4',
  'Team 5', 'Team 6', 'Team 7', 'Team 8',
];

function createParticipants(names) {
  return names.map((name, i) => ({ id: `p-${i}`, name, seed: i + 1 }));
}

export default function App() {
  const [title, setTitle] = useState('Tournament Bracket');
  const [logo, setLogo] = useState(null);
  const [themeName, setThemeName] = useState('bw');
  const [bracketType, setBracketType] = useState('single');
  const [showSeeds, setShowSeeds] = useState(true);
  const [printMargin, setPrintMargin] = useState(0);
  const [layout, setLayout] = useState('standard');
  const [bracketStyle, setBracketStyle] = useState('boxed');
  const [participantsMode, setParticipantsMode] = useState('add-teams');
  const [participantNames, setParticipantNames] = useState(DEFAULT_PARTICIPANTS);
  const [bracket, setBracket] = useState(null);
  const [doubleBracket, setDoubleBracket] = useState(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const bracketRef = useRef(null);

  const theme = THEMES[themeName];

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

    if (bracketType === 'single') {
      const result = generateSingleElimination(participants);
      setBracket(result);
      setDoubleBracket(null);
    } else {
      const result = generateDoubleElimination(participants);
      setDoubleBracket(result);
      setBracket(null);
    }
    setIsGenerated(true);
  }, [participantNames, bracketType, participantsMode]);

  const handleAdvanceWinner = useCallback((matchId, team, bracketSection) => {
    if (bracketType === 'single' && bracket) {
      const newRounds = advanceWinner(bracket.rounds, matchId, team);
      setBracket({ ...bracket, rounds: newRounds });
    } else if (bracketType === 'double' && doubleBracket) {
      if (bracketSection === 'winners') {
        const newRounds = advanceWinner(doubleBracket.winnersRounds, matchId, team);
        setDoubleBracket({ ...doubleBracket, winnersRounds: newRounds });
      } else if (bracketSection === 'losers') {
        const newRounds = advanceWinner(doubleBracket.losersRounds, matchId, team);
        setDoubleBracket({ ...doubleBracket, losersRounds: newRounds });
      } else if (bracketSection === 'grandFinals') {
        const newGF = advanceWinner([doubleBracket.grandFinals], matchId, team);
        setDoubleBracket({ ...doubleBracket, grandFinals: newGF[0] });
      }
    }
  }, [bracket, doubleBracket, bracketType]);

  const handleReset = useCallback(() => {
    setBracket(null);
    setDoubleBracket(null);
    setIsGenerated(false);
  }, []);

  return (
    <div style={{ background: theme.bg, color: theme.text, minHeight: '100vh' }}
         className="transition-colors duration-300">
      <Header
        title={title}
        setTitle={setTitle}
        logo={logo}
        setLogo={setLogo}
        theme={theme}
      />

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
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
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
              <ExportButtons bracketRef={bracketRef} title={title} theme={theme} printMargin={printMargin} />
            </div>

            <div ref={bracketRef}>
              <BracketView
                bracket={bracket}
                doubleBracket={doubleBracket}
                bracketType={bracketType}
                bracketStyle={bracketStyle}
                layout={layout}
                theme={theme}
                title={title}
                logo={logo}
                onAdvanceWinner={handleAdvanceWinner}
                showSeeds={showSeeds}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
