// Shared SVG baseline formula: center + 36% of fontSize ≈ half cap-height offset.
// html2canvas honors literal SVG y values — this is the only reliable centering approach.
function svgBaselineY(height, fontSize) { return height / 2 + fontSize * 0.36; }

function SeedBadge({ seed, theme, isWinner, isLine }) {
  const seedStr = String(seed);
  const FS = 11;
  const W = seedStr.length === 1 ? 20 : 24;
  const H = 18;
  const BASELINE_Y = svgBaselineY(H, FS);
  const fillBg = isLine || isWinner ? 'transparent' : theme.accent + '20';
  const fillText = isWinner ? (isLine ? theme.accent : theme.winnerText + 'bb') : (isLine ? theme.textMuted : theme.accent);
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        marginRight: '6px',
      }}
    >
      {!isLine && !isWinner && (
        <rect width={W} height={H} rx="3" ry="3" fill={fillBg} />
      )}
      <text
        x={W / 2}
        y={BASELINE_Y}
        textAnchor="middle"
        fontSize={FS}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight="600"
        fill={fillText}
      >
        {seedStr}
      </text>
    </svg>
  );
}

function Pill({ text, color, bg, fontSize = 11, paddingX = 14, marginBottom = 0 }) {
  // SVG-based pill label with precise text centering. Approximates text width
  // by char count (sans-serif uppercase ≈ 0.7em per char).
  const charW = fontSize * 0.7;
  const textW = text.length * charW;
  const W = Math.ceil(textW + paddingX * 2);
  const H = Math.ceil(fontSize * 2.4);
  const BASELINE_Y = svgBaselineY(H, fontSize);
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', marginBottom: `${marginBottom}px` }}
    >
      <rect width={W} height={H} rx={H / 2} ry={H / 2} fill={bg} />
      <text
        x={W / 2}
        y={BASELINE_Y}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="700"
        letterSpacing="0.6"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fill={color}
      >
        {text.toUpperCase()}
      </text>
    </svg>
  );
}

export { Pill };

function TeamSlot({ team, isWinner, onAdvance, theme, position, bracketStyle, sizing, showSeeds, isChampionship }) {
  const isEmpty = !team;
  const displayName = team?.name || '';
  const isLine = bracketStyle === 'line';
  const padY = sizing?.padY || 8;

  const handleClick = () => {
    if (team && onAdvance) onAdvance(team);
  };

  // Generous padding-bottom + lineHeight on a wrapper line element guarantees
  // descenders ("g", "p", "y", and curved digit bottoms) have room to render
  // without being clipped by any parent overflow.
  const slotStyle = isLine
    ? {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingTop: `${padY + 4}px`,
        paddingBottom: `${padY + 8}px`,
        borderBottom: `2px solid ${theme.connector}`,
      }
    : {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingTop: `${padY + 4}px`,
        paddingBottom: `${padY + 8}px`,
        // Each slot is now a fully self-contained card (full border, all corners rounded)
        // so the parent wrapper can space them with a gap between the two boxes.
        // Championship slots use the accent gradient + 4px accent border individually
        // because the outer wrapper no longer carries the championship styling (the gap
        // would expose the outer gradient between the two slots otherwise).
        background: isChampionship
          ? 'linear-gradient(180deg, #fef3c7, #fefce8)'
          : (isWinner ? theme.winnerBg : theme.cardBg),
        border: `${isChampionship ? 4 : 1}px solid ${isChampionship ? theme.accent : theme.cardBorder}`,
        borderRadius: '8px',
      };

  // No overflow:hidden — that's what was clipping descenders in html2canvas.
  // Long names will overflow the card horizontally, but for "Team 1"-"Team 99" they fit fine.
  const nameStyle = isLine
    ? {
        flex: '1 1 0',
        minWidth: 0,
        fontSize: '14px',
        fontWeight: isWinner ? 700 : isEmpty ? 400 : 500,
        color: isWinner ? theme.accent : isEmpty ? 'transparent' : theme.text,
        whiteSpace: 'nowrap',
        lineHeight: 1.5,
      }
    : {
        flex: '1 1 0',
        minWidth: 0,
        fontSize: '14px',
        fontWeight: 500,
        color: isWinner ? theme.winnerText : isEmpty ? theme.textMuted : theme.text,
        whiteSpace: 'nowrap',
        lineHeight: 1.5,
        opacity: isEmpty ? 0.2 : 1,
      };

  return (
    <div
      style={slotStyle}
      className={!isEmpty && onAdvance ? (isLine ? 'cursor-pointer hover:opacity-70' : 'cursor-pointer hover:brightness-110') : ''}
      onClick={handleClick}
      title={!isEmpty && onAdvance ? `Click to advance ${displayName}` : ''}
      data-team-slot={position}
    >
      <span style={nameStyle}>
        {showSeeds !== false && team?.seed && (
          <SeedBadge seed={team.seed} theme={theme} isWinner={isWinner} isLine={isLine} />
        )}
        <span style={{ verticalAlign: 'middle' }}>
          {displayName || (isLine ? '\u00A0' : '\u2013')}
        </span>
      </span>
      {isWinner && (
        <svg width={isLine ? 10 : 12} height={isLine ? 10 : 12} viewBox="0 0 24 24" fill="none"
             stroke={isLine ? theme.accent : theme.winnerText} strokeWidth="3"
             style={{ flexShrink: 0 }}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </div>
  );
}

export default function MatchCard({ match, theme, onAdvanceWinner, bracketSection, sizing, showSeeds, isChampionship, bracketStyle }) {
  const { team1, team2, winner, isBye } = match;
  const isLine = bracketStyle === 'line';

  // Proportional to padY so gap scales across the 8 sizing tiers (padY 3..14 maps to gap 3..10).
  // Floor at 3px so dense 64-match brackets still show separation.
  // Applied only in boxed mode — line style keeps its original flush layout.
  const padY = sizing?.padY || 8;
  const slotGap = Math.max(3, Math.round(padY * 0.7));

  if (isBye && winner) {
    // Bye slots reserve layout space but render nothing. Any paint-producing
    // style (className, background, opacity, rounded corners) causes html2canvas
    // to rasterize a grey rectangle; keeping only sizing sidesteps the bug.
    // minH formula: two slots (each 2*padY + 28 content height) + slotGap between
    // them + 2px for the extra top+bottom borders that now exist on two separate
    // cards (vs. the old shared outer border). Keeps sibling real matches aligned.
    const minH = 2 * (2 * padY + 28) + slotGap + 2;
    return (
      <div
        style={{
          width: `${sizing?.cardW || 192}px`,
          minHeight: `${minH}px`,
        }}
        data-match-id={match.id}
        data-is-bye="true"
      />
    );
  }

  const canAdvance = team1 && team2 && !winner;
  const handleAdvance = (team) => {
    if (canAdvance && onAdvanceWinner) onAdvanceWinner(match.id, team, bracketSection);
  };

  const cardW = sizing?.cardW || 192;
  const champCardW = isChampionship ? Math.round(cardW * 1.5) : cardW;

  // Outer wrapper is now a bare layout container in boxed mode — each TeamSlot
  // carries its own border/background/radius (and championship styling). This
  // lets us put a real gap between the two slots so they look like two boxes.
  // Line mode keeps its original flush layout (no gap, no border on wrapper).
  const cardStyle = isLine
    ? {
        width: `${champCardW}px`,
      }
    : {
        width: `${champCardW}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${slotGap}px`,
      };

  // Championship slots get extra padding for visual weight
  const champSizing = isChampionship
    ? { ...sizing, padY: Math.max((sizing?.padY || 8) + 6, 14) }
    : sizing;

  return (
    <div className={isChampionship ? 'flex flex-col items-center' : undefined}>
      {isChampionship && (
        <>
          <div style={{ marginBottom: '4px' }}>
            <Pill text="🏆 CHAMPS" color={theme.accent} bg={theme.accent + '22'} fontSize={9} paddingX={10} />
          </div>
          {/* CHAMPS winner singleton: width wrapper only; TeamSlot renders its own */}
          {/* accent border + gradient via isChampionship so there's no double-border nesting. */}
          <div style={{ width: `${champCardW}px` }}>
            <TeamSlot
              team={winner}
              isWinner={!!winner}
              theme={theme}
              position="bottom"
              bracketStyle={bracketStyle}
              sizing={champSizing}
              showSeeds={showSeeds}
              isChampionship={true}
            />
          </div>
          <div style={{ width: '2px', height: '10px', background: theme.connector }} />
          <div style={{ marginBottom: '4px' }}>
            <Pill text="FINALS" color={theme.accent} bg={theme.accent + '22'} fontSize={9} paddingX={10} />
          </div>
        </>
      )}
      <div style={cardStyle} data-match-id={match.id}>
        <TeamSlot
          team={team1}
          isWinner={winner && winner.id === team1?.id}
          onAdvance={canAdvance ? handleAdvance : null}
          theme={theme}
          position="top"
          bracketStyle={bracketStyle}
          sizing={champSizing}
          showSeeds={showSeeds}
          isChampionship={isChampionship}
        />
        <TeamSlot
          team={team2}
          isWinner={winner && winner.id === team2?.id}
          onAdvance={canAdvance ? handleAdvance : null}
          theme={theme}
          position="bottom"
          bracketStyle={bracketStyle}
          sizing={champSizing}
          showSeeds={showSeeds}
          isChampionship={isChampionship}
        />
      </div>
    </div>
  );
}
