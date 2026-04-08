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
}) {
  const roundLabel = label || getRoundLabel(roundIndex, totalRounds);

  // Calculate spacing - matches spread out more in later rounds
  // Each match in round N feeds 2 matches from round N-1
  // We want to vertically center each match between its two feeder matches

  return (
    <div className="flex flex-col items-center shrink-0" style={{ minWidth: '208px' }}>
      <div
        className="text-xs font-bold uppercase tracking-wider mb-4 px-3 py-1 rounded-full"
        style={{ color: theme.roundLabel, background: theme.roundLabel + '15' }}
      >
        {roundLabel}
      </div>
      <div
        className="flex flex-col justify-around flex-1"
        style={{ gap: `${Math.pow(2, roundIndex) * 16}px` }}
      >
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection={bracketSection}
            bracketStyle={bracketStyle}
          />
        ))}
      </div>
    </div>
  );
}
