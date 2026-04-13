import MatchCard, { Pill } from './MatchCard';
import { getRoundLabel } from '../utils/bracketLogic';

export default function BracketRound({
  matches,
  roundIndex,
  totalRounds,
  theme,
  onAdvanceWinner,
  bracketSection,
  label,
  sizing,
  showSeeds,
  isChampionship,
  bracketStyle,
}) {
  const roundLabel = label || getRoundLabel(roundIndex, totalRounds);
  const roundW = sizing?.roundW || 224;

  return (
    <div className="flex flex-col items-center shrink-0" style={{ minWidth: `${roundW}px` }}>
      <Pill text={roundLabel} color={theme.roundLabel} bg={theme.roundLabel + '15'} fontSize={11} paddingX={14} marginBottom={14} />
      <div className="flex flex-col justify-around flex-1">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection={bracketSection}
            sizing={sizing}
            showSeeds={showSeeds}
            isChampionship={isChampionship}
            bracketStyle={bracketStyle}
          />
        ))}
      </div>
    </div>
  );
}
