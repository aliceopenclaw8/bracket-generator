function TeamSlot({ team, isWinner, onAdvance, theme, position, bracketStyle }) {
  const isEmpty = !team;
  const displayName = team?.name || '';

  const handleClick = () => {
    if (team && onAdvance) {
      onAdvance(team);
    }
  };

  if (bracketStyle === 'line') {
    return (
      <div
        className={`flex items-center gap-2 px-2 py-1 transition-all ${
          !isEmpty && onAdvance ? 'cursor-pointer hover:opacity-70' : ''
        }`}
        style={{
          borderBottom: `1px solid ${theme.cardBorder}`,
        }}
        onClick={handleClick}
        title={!isEmpty && onAdvance ? `Click to advance ${displayName}` : ''}
      >
        {team?.seed && (
          <span
            className="text-[10px] font-mono w-5 text-center shrink-0"
            style={{ color: isWinner ? theme.accent : theme.textMuted }}
          >
            {team.seed}
          </span>
        )}
        <span
          className={`text-sm truncate flex-1 ${isWinner ? 'font-bold' : isEmpty ? '' : 'font-medium'}`}
          style={{ color: isWinner ? theme.accent : isEmpty ? 'transparent' : theme.text }}
        >
          {displayName || '\u00A0'}
        </span>
        {isWinner && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke={theme.accent} strokeWidth="3" className="shrink-0">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </div>
    );
  }

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
        className={`text-sm truncate flex-1 ${isEmpty ? 'opacity-20' : 'font-medium'}`}
        style={{ color: isWinner ? theme.winnerText : isEmpty ? theme.textMuted : theme.text }}
      >
        {displayName || '\u2013'}
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

export default function MatchCard({ match, theme, onAdvanceWinner, bracketSection, bracketStyle }) {
  const { team1, team2, winner, isBye } = match;

  if (isBye && winner) {
    return (
      <div
        className={`${bracketStyle === 'line' ? '' : 'rounded-lg'} overflow-hidden w-48 opacity-50`}
        style={{ border: bracketStyle === 'line' ? 'none' : `1px solid ${theme.cardBorder}` }}
        data-match-id={match.id}
      >
        <TeamSlot team={winner} isWinner={false} theme={theme} position="top" bracketStyle={bracketStyle} />
        <TeamSlot team={null} isWinner={false} theme={theme} position="bottom" bracketStyle={bracketStyle} />
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
      className={`${bracketStyle === 'line' ? '' : 'rounded-lg shadow-lg hover:shadow-xl'} overflow-hidden w-48 transition-shadow`}
      style={{ border: bracketStyle === 'line' ? 'none' : `1px solid ${theme.cardBorder}` }}
      data-match-id={match.id}
    >
      <TeamSlot
        team={team1}
        isWinner={winner && winner.id === team1?.id}
        onAdvance={canAdvance ? handleAdvance : null}
        theme={theme}
        position="top"
        bracketStyle={bracketStyle}
      />
      <TeamSlot
        team={team2}
        isWinner={winner && winner.id === team2?.id}
        onAdvance={canAdvance ? handleAdvance : null}
        theme={theme}
        position="bottom"
        bracketStyle={bracketStyle}
      />
    </div>
  );
}
