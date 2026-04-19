import { useRef, useState, useLayoutEffect } from 'react';

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
  const containerRef = useRef(null);
  const [spineData, setSpineData] = useState(null);

  // Championship uses a fixed 20px gap for visual emphasis on the champion column.
  // Regular matches cap at 12px to keep dense 64-team brackets compact while giving
  // the right-edge spine connector enough vertical span to be visible.
  const padY = sizing?.padY || 8;
  const slotGap = isChampionship
    ? 20
    : Math.max(4, Math.min(12, padY));

  // Measures slot centers so the right-edge spine SVG can draw taps at the correct
  // y-coordinates. Championship also includes the CHAMPS winner singleton (data-champ-winner)
  // as the first spine point. Re-runs on ResizeObserver for scale changes from AutoScaleWrapper.
  // Divides measurements by scale because getBoundingClientRect returns transformed (visual)
  // pixels but SVG internal coordinates are in pre-transform CSS pixels. Mirrors BracketConnectors.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || isLine || (isBye && winner)) return;

    const update = () => {
      const scaleEl = container.closest('[data-auto-scale]');
      const scale = scaleEl ? parseFloat(scaleEl.dataset.autoScale) || 1 : 1;
      const cRect = container.getBoundingClientRect();
      const topSlot = container.querySelector('[data-team-slot="top"]');
      const bottomSlot = container.querySelector('[data-team-slot="bottom"]');
      if (!topSlot || !bottomSlot) return;

      const points = [];
      if (isChampionship) {
        const champWinner = container.querySelector('[data-champ-winner] [data-team-slot]');
        if (champWinner) {
          const wRect = champWinner.getBoundingClientRect();
          points.push(((wRect.top + wRect.bottom) / 2 - cRect.top) / scale);
        }
      }
      const tRect = topSlot.getBoundingClientRect();
      const bRect = bottomSlot.getBoundingClientRect();
      points.push(((tRect.top + tRect.bottom) / 2 - cRect.top) / scale);
      points.push(((bRect.top + bRect.bottom) / 2 - cRect.top) / scale);

      setSpineData({ points, height: cRect.height / scale });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [isLine, isBye, winner, isChampionship, padY]);

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
    <div
      ref={containerRef}
      className={isChampionship ? 'flex flex-col items-center' : undefined}
      style={{ position: 'relative', paddingRight: isLine ? undefined : '10px' }}
      data-match-id={isChampionship ? undefined : match.id}
    >
      {isChampionship && (
        <>
          <div style={{ marginBottom: '8px' }}>
            <Pill text="🏆 CHAMPS" color={theme.accent} bg={theme.accent + '22'} fontSize={9} paddingX={10} />
          </div>
          {/* CHAMPS winner singleton: width wrapper only; TeamSlot renders its own */}
          {/* accent border + gradient via isChampionship so there's no double-border nesting. */}
          {/* data-champ-winner marks this for the spine SVG's first tap point. */}
          {/* position="champion" (not "top"/"bottom") so the spine's querySelector */}
          {/* for data-team-slot="bottom" doesn't accidentally match the winner instead of team2. */}
          <div style={{ width: `${champCardW}px` }} data-champ-winner>
            <TeamSlot
              team={winner}
              isWinner={!!winner}
              theme={theme}
              position="champion"
              bracketStyle={bracketStyle}
              sizing={champSizing}
              showSeeds={showSeeds}
              isChampionship={true}
            />
          </div>
          <div style={{ marginTop: '10px', marginBottom: '8px' }}>
            <Pill text="FINALS" color={theme.accent} bg={theme.accent + '22'} fontSize={9} paddingX={10} />
          </div>
        </>
      )}
      {/* For championship matches, data-match-id sits on the inner cardStyle div so
          progression connectors (BracketConnectors) aim at the actual FINAL match
          center, not the outer wrapper center (which would land in the CHAMPS/FINALS
          pill area above). For regular matches, data-match-id is on the outer wrapper
          so connector measurements include the spine's paddingRight. */}
      <div style={cardStyle} data-match-id={isChampionship ? match.id : undefined}>
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

      {/* Right-edge spine connector: vertical line with horizontal taps at each slot center.
          For championship, spans CHAMPS winner + team1 + team2 (3 points).
          For regular matches, spans team1 + team2 (2 points).
          Tap length 8px gives clear visual breathing between box and spine;
          spine sits at x=8 with paddingRight=10px leaving a 2px margin before connectors.
          Skipped in line bracketStyle — flush slots have no boxes to connect. */}
      {!isLine && spineData && spineData.points.length >= 2 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '10px',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          {spineData.points.map((y, i) => (
            <line
              key={i}
              x1="0"
              y1={y}
              x2="8"
              y2={y}
              stroke={theme.connector}
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
          <line
            x1="8"
            y1={spineData.points[0]}
            x2="8"
            y2={spineData.points[spineData.points.length - 1]}
            stroke={theme.connector}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
