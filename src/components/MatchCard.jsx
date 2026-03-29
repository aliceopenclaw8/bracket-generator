function TeamSlot({ team, isWinner, onAdvance, theme, position }) {
  const isEmpty = !team;
  const displayName = team?.name || 'TBD';

  const handleClick = () => {
    if (team && onAdvance) {
      onAdvance(team);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 transition-all ${
        !isEmpty && onAdvance ? 'cursor-pointer hover:brightness-110' : ''
      } ${position === 'top' ? 'rounded-t-lg' : 'rounded-b-lg'}`}
      style={{
        background: isWinner ? theme.winnerBg : theme.cardBg,
        borderBottom: position === 'top' ? `1px solid ${theme.cardBorder}` : 'none',
      }}
      onClick={handleClick}
      title={!isEmpty && onAdvance ? `Click to advance ${displayName}` : ''}
    >
      {team?.seed && (
        <span
          className="text-[10px] font-mono w-5 text-center shrink-0 rounded"
          style={{
            color: isWinner ? theme.winnerText + 'bb' : theme.accent,
            background: isWinner ? 'transparent' : theme.accent + '15',
          }}
        >
          {team.seed}
        </span>
      )}
      <span
        className={`text-sm truncate flex-1 ${isEmpty ? 'italic opacity-40' : 'font-medium'}`}
        style={{ color: isWinner ? theme.winnerText : isEmpty ? theme.textMuted : theme.text }}
      >
        {displayName}
      </span>
      {isWinner && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke={theme.winnerText} strokeWidth="3" className="shrink-0">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </div>
  );
}

export default function MatchCard({ match, theme, onAdvanceWinner, bracketSection }) {
  const { team1, team2, winner, isBye } = match;

  if (isBye && winner) {
    return (
      <div
        className="rounded-lg overflow-hidden w-48 opacity-50"
        style={{ border: `1px solid ${theme.cardBorder}` }}
        data-match-id={match.id}
      >
        <TeamSlot team={winner} isWinner={false} theme={theme} position="top" />
        <TeamSlot team={null} isWinner={false} theme={theme} position="bottom" />
      </div>
    );
  }

  const canAdvance = team1 && team2 && !winner;

  const handleAdvance = (team) => {
    if (canAdvance && onAdvanceWinner) {
      onAdvanceWinner(match.id, team, bracketSection);
    }
  };

  return (
    <div
      className="rounded-lg overflow-hidden w-48 shadow-lg transition-shadow hover:shadow-xl"
      style={{ border: `1px solid ${theme.cardBorder}` }}
      data-match-id={match.id}
    >
      <TeamSlot
        team={team1}
        isWinner={winner && winner.id === team1?.id}
        onAdvance={canAdvance ? handleAdvance : null}
        theme={theme}
        position="top"
      />
      <TeamSlot
        team={team2}
        isWinner={winner && winner.id === team2?.id}
        onAdvance={canAdvance ? handleAdvance : null}
        theme={theme}
        position="bottom"
      />
    </div>
  );
}
