function TeamSlot({ team, isWinner, onAdvance, theme, position, sizing, showSeeds }) {
  const isEmpty = !team;
  const displayName = team?.name || '';

  const handleClick = () => {
    if (team && onAdvance) {
      onAdvance(team);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 transition-all ${
        !isEmpty && onAdvance ? 'cursor-pointer hover:brightness-110' : ''
      } ${position === 'top' ? 'rounded-t-lg' : 'rounded-b-lg'}`}
      style={{
        background: isWinner ? theme.winnerBg : theme.cardBg,
        borderBottom: position === 'top' ? `1px solid ${theme.cardBorder}` : 'none',
        paddingTop: `${sizing?.padY || 8}px`,
        paddingBottom: `${sizing?.padY || 8}px`,
      }}
      onClick={handleClick}
      title={!isEmpty && onAdvance ? `Click to advance ${displayName}` : ''}
    >
      {showSeeds !== false && team?.seed && (
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

export default function MatchCard({ match, theme, onAdvanceWinner, bracketSection, sizing, showSeeds }) {
  const { team1, team2, winner, isBye } = match;

  if (isBye && winner) {
    // minHeight matches a regular 2-slot card so justify-around alignment is consistent
    const padY = sizing?.padY || 8;
    const minH = 2 * (2 * padY + 20) + 2;
    // Byes are rendered with visibility:hidden so they preserve flex layout spacing
    // (pair-midpoint alignment for R2 connectors depends on R1 slots occupying their
    // normal vertical footprint) while being visually invisible to the user.
    // data-is-bye marker lets BracketConnectors skip drawing lines from bye sources.
    return (
      <div
        className="flex items-center justify-center rounded-lg"
        style={{
          width: `${sizing?.cardW || 192}px`,
          padding: `${padY}px 8px`,
          minHeight: `${minH}px`,
          visibility: 'hidden',
        }}
        data-match-id={match.id}
        data-is-bye="true"
      >
        {/* Placeholder content to preserve intrinsic height; visibility:hidden hides it */}
        <span className="text-sm">&nbsp;</span>
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
      className="rounded-lg shadow-lg hover:shadow-xl overflow-hidden transition-shadow"
      style={{ border: `1px solid ${theme.cardBorder}`, width: `${sizing?.cardW || 192}px` }}
      data-match-id={match.id}
    >
      <TeamSlot
        team={team1}
        isWinner={winner && winner.id === team1?.id}
        onAdvance={canAdvance ? handleAdvance : null}
        theme={theme}
        position="top"
        sizing={sizing}
        showSeeds={showSeeds}
      />
      <TeamSlot
        team={team2}
        isWinner={winner && winner.id === team2?.id}
        onAdvance={canAdvance ? handleAdvance : null}
        theme={theme}
        position="bottom"
        sizing={sizing}
        showSeeds={showSeeds}
      />
    </div>
  );
}
