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
    // flex:1 so rounds grow to fill the stretched parent width instead of leaving gaps.
    // minWidth preserves legibility at small counts; flex-grow absorbs extra space.
    <div className="flex flex-col items-center" style={{ minWidth: `${roundW}px`, flex: '1 1 0' }}>
      <Pill text={roundLabel} color={theme.roundLabel} bg={theme.roundLabel + '15'} fontSize={8} paddingX={8} marginBottom={6} />
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
