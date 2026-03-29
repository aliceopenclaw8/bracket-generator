import { useRef } from 'react';
import BracketRound from './BracketRound';
import BracketConnectors from './BracketConnectors';
import { getRoundLabel } from '../utils/bracketLogic';

function ChampionDisplay({ rounds, theme }) {
  const lastRound = rounds[rounds.length - 1];
  if (!lastRound || lastRound.length !== 1) return null;
  const finalMatch = lastRound[0];
  if (!finalMatch.winner) return null;

  return (
    <div className="flex flex-col items-center justify-center shrink-0 ml-8" style={{ minWidth: '180px' }}>
      <div
        className="text-xs font-bold uppercase tracking-wider mb-3 px-3 py-1 rounded-full"
        style={{ color: theme.accent, background: theme.accent + '15' }}
      >
        Champion
      </div>
      <div
        className="rounded-xl p-4 text-center shadow-2xl"
        style={{
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
          border: `2px solid ${theme.accent}`,
          minWidth: '160px',
        }}
      >
        <div className="text-2xl mb-2">🏆</div>
        <div className="font-bold text-lg" style={{ color: theme.winnerText }}>
          {finalMatch.winner.name}
        </div>
        {finalMatch.winner.seed && (
          <div className="text-xs mt-1 opacity-70" style={{ color: theme.winnerText }}>
            Seed #{finalMatch.winner.seed}
          </div>
        )}
      </div>
    </div>
  );
}

function SingleBracket({ bracket, theme, onAdvanceWinner }) {
  const containerRef = useRef(null);

  return (
    <div className="relative" ref={containerRef}>
      <BracketConnectors containerRef={containerRef} rounds={bracket.rounds} theme={theme} />
      <div className="flex items-stretch gap-0" style={{ padding: '20px 0' }}>
        {bracket.rounds.map((matches, roundIdx) => (
          <BracketRound
            key={roundIdx}
            matches={matches}
            roundIndex={roundIdx}
            totalRounds={bracket.rounds.length}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection="winners"
          />
        ))}
        <ChampionDisplay rounds={bracket.rounds} theme={theme} />
      </div>
    </div>
  );
}

function DoubleBracket({ doubleBracket, theme, onAdvanceWinner }) {
  const winnersRef = useRef(null);
  const losersRef = useRef(null);

  return (
    <div className="space-y-8">
      {/* Winners Bracket */}
      <div>
        <div
          className="inline-block text-sm font-bold uppercase tracking-wider mb-3 px-3 py-1 rounded-full"
          style={{ color: theme.accent, background: theme.accent + '15' }}
        >
          Winners Bracket
        </div>
        <div className="relative" ref={winnersRef}>
          <BracketConnectors containerRef={winnersRef} rounds={doubleBracket.winnersRounds} theme={theme} />
          <div className="flex items-stretch gap-0" style={{ padding: '20px 0' }}>
            {doubleBracket.winnersRounds.map((matches, roundIdx) => (
              <BracketRound
                key={roundIdx}
                matches={matches}
                roundIndex={roundIdx}
                totalRounds={doubleBracket.winnersRounds.length}
                theme={theme}
                onAdvanceWinner={onAdvanceWinner}
                bracketSection="winners"
                label={getRoundLabel(roundIdx, doubleBracket.winnersRounds.length)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Losers Bracket */}
      <div>
        <div
          className="inline-block text-sm font-bold uppercase tracking-wider mb-3 px-3 py-1 rounded-full"
          style={{ color: theme.textMuted, background: theme.textMuted + '15' }}
        >
          Losers Bracket
        </div>
        <div className="relative" ref={losersRef}>
          <BracketConnectors containerRef={losersRef} rounds={doubleBracket.losersRounds} theme={theme} />
          <div className="flex items-stretch gap-0" style={{ padding: '20px 0' }}>
            {doubleBracket.losersRounds.map((matches, roundIdx) => (
              <BracketRound
                key={roundIdx}
                matches={matches}
                roundIndex={roundIdx}
                totalRounds={doubleBracket.losersRounds.length}
                theme={theme}
                onAdvanceWinner={onAdvanceWinner}
                bracketSection="losers"
                label={`Losers R${roundIdx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Grand Finals */}
      <div>
        <div
          className="inline-block text-sm font-bold uppercase tracking-wider mb-3 px-3 py-1 rounded-full"
          style={{ color: theme.accent, background: theme.accent + '15' }}
        >
          Grand Finals
        </div>
        <div className="flex items-center gap-4 py-4">
          <BracketRound
            matches={doubleBracket.grandFinals}
            roundIndex={0}
            totalRounds={1}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection="grandFinals"
            label="Grand Finals"
          />
        </div>
      </div>
    </div>
  );
}

export default function BracketView({ bracket, doubleBracket, bracketType, theme, title, logo, onAdvanceWinner }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: theme.bg,
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      {/* Bracket Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ borderColor: theme.cardBorder, background: theme.headerBg }}
      >
        {logo && (
          <img src={logo} alt="Logo" className="w-8 h-8 rounded object-cover" />
        )}
        <h2 className="text-xl font-bold" style={{ color: theme.text }}>
          {title}
        </h2>
        <span
          className="text-xs px-2 py-1 rounded-full ml-auto"
          style={{ background: theme.accent + '22', color: theme.accent }}
        >
          {bracketType === 'single' ? 'Single Elimination' : 'Double Elimination'}
        </span>
      </div>

      {/* Bracket Content */}
      <div className="p-6 overflow-x-auto bracket-scroll">
        {bracketType === 'single' && bracket && (
          <SingleBracket bracket={bracket} theme={theme} onAdvanceWinner={onAdvanceWinner} />
        )}
        {bracketType === 'double' && doubleBracket && (
          <DoubleBracket doubleBracket={doubleBracket} theme={theme} onAdvanceWinner={onAdvanceWinner} />
        )}
      </div>
    </div>
  );
}
