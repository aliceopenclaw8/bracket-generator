import MatchCard from './MatchCard';
import { getRoundLabel } from '../utils/bracketLogic';

export default function BracketRound({
  matches,
  roundIndex,
  totalRounds,
  theme,
  onAdvanceWinner,
  bracketSection,
  label,
  bracketStyle = 'boxed',
  sizing,
  showSeeds,
}) {
  const roundLabel = label || getRoundLabel(roundIndex, totalRounds);
  const baseGap = sizing?.baseGap || 32;
  const roundW = sizing?.roundW || 224;

  return (
    <div className="flex flex-col items-center shrink-0" style={{ minWidth: `${roundW}px` }}>
      <div
        className="text-xs font-bold uppercase tracking-wider mb-4 px-3 py-1 rounded-full"
        style={{ color: theme.roundLabel, background: theme.roundLabel + '15' }}
      >
        {roundLabel}
      </div>
      <div
        className="flex flex-col justify-around flex-1"
        style={{ gap: `${Math.pow(2, roundIndex) * baseGap}px` }}
      >
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection={bracketSection}
            bracketStyle={bracketStyle}
            sizing={sizing}
            showSeeds={showSeeds}
          />
        ))}
      </div>
    </div>
  );
}
