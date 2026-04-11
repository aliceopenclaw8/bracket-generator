import { useRef, useEffect, useState } from 'react';
import BracketRound from './BracketRound';
import BracketConnectors from './BracketConnectors';
import { getRoundLabel } from '../utils/bracketLogic';
import { splitBracketForDoubleSided } from '../utils/bracketLogic';

function computeBracketSizing(firstRoundMatchCount, layout) {
  if (firstRoundMatchCount <= 2) return { cardW: 220, padY: 18, baseGap: 100, roundW: 260 };
  if (firstRoundMatchCount <= 4) return { cardW: 200, padY: 14, baseGap: 72, roundW: 240 };
  if (firstRoundMatchCount <= 8) {
    // 16-team double-sided brackets place 8 first-round cards across the horizontal axis
    // and overflow US Letter landscape width on PDF export when using the normal card size.
    // Apply the compact sizing from the 33+ bucket ONLY for that specific case. All other
    // 9-16 team brackets (including 16 Standard) keep the normal 192px card width.
    if (firstRoundMatchCount === 8 && layout === 'double-sided') {
      return { cardW: 160, padY: 3, baseGap: 8, roundW: 192 };
    }
    return { cardW: 192, padY: 8, baseGap: 32, roundW: 224 };
  }
  if (firstRoundMatchCount <= 16) return { cardW: 176, padY: 5, baseGap: 16, roundW: 208 };
  return { cardW: 160, padY: 3, baseGap: 8, roundW: 192 };
}

function AutoScaleWrapper({ children, enabled }) {
  const wrapperRef = useRef(null);
  const contentRef = useRef(null);
  const [dims, setDims] = useState({ scale: 1, naturalW: 0, naturalH: 0, ready: !enabled });

  useEffect(() => {
    if (!enabled) return;

    const content = contentRef.current;
    const wrapper = wrapperRef.current;
    if (!content || !wrapper) return;

    const update = () => {
      const naturalW = content.scrollWidth;
      const naturalH = content.scrollHeight;
      const availW = wrapper.clientWidth;
      const availH = Math.max(window.innerHeight - 280, 400);

      if (naturalW <= 0 || naturalH <= 0) return;

      const s = Math.max(0.35, Math.min(2, availW / naturalW, availH / naturalH));
      setDims({ scale: s, naturalW, naturalH, ready: true });
    };

    const timer = setTimeout(update, 80);
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    ro.observe(content); // Also observe content so scale recalculates when bracket changes size

    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [enabled]);

  if (!enabled) return children;

  const { scale, naturalW, naturalH, ready } = dims;

  return (
    <div ref={wrapperRef} style={{ width: '100%' }}>
      <div
        ref={contentRef}
        data-auto-scale={scale}
        style={{
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          width: 'max-content',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.2s',
          marginRight: naturalW ? `${naturalW * (scale - 1)}px` : 0,
          marginBottom: naturalH ? `${naturalH * (scale - 1)}px` : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ChampionDisplay({ rounds, theme, showSeeds }) {
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
        {showSeeds !== false && finalMatch.winner.seed && (
          <div className="text-xs mt-1 opacity-70" style={{ color: theme.winnerText }}>
            Seed #{finalMatch.winner.seed}
          </div>
        )}
      </div>
    </div>
  );
}

function SingleBracket({ bracket, theme, onAdvanceWinner, bracketStyle, sizing, showSeeds }) {
  const containerRef = useRef(null);

  return (
    <div className="relative" ref={containerRef}>
      <BracketConnectors containerRef={containerRef} rounds={bracket.rounds} theme={theme} bracketStyle={bracketStyle} />
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
            bracketStyle={bracketStyle}
            sizing={sizing}
            showSeeds={showSeeds}
          />
        ))}
        <ChampionDisplay rounds={bracket.rounds} theme={theme} showSeeds={showSeeds} />
      </div>
    </div>
  );
}

function FinalsConnectors({ containerRef, west, east, finals, theme, bracketStyle = 'boxed' }) {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !finals.length) return;

    const updateLines = () => {
      const containerRect = container.getBoundingClientRect();
      // Account for CSS transform scale (AutoScaleWrapper)
      const scaleEl = container.closest('[data-auto-scale]');
      const scale = scaleEl ? parseFloat(scaleEl.dataset.autoScale) || 1 : 1;
      const newLines = [];

      // Line style anchor: midpoint between the top slot's borderBottom and the bottom slot's
      // borderBottom. Matches BracketConnectors behavior so finals connectors meet the
      // team underlines instead of floating in the empty space between them.
      const computeMatchY = (matchEl, matchRect) => {
        if (bracketStyle === 'line') {
          const topSlot = matchEl.querySelector('[data-team-slot="top"]');
          const bottomSlot = matchEl.querySelector('[data-team-slot="bottom"]');
          if (topSlot && bottomSlot) {
            const topRect = topSlot.getBoundingClientRect();
            const bottomRect = bottomSlot.getBoundingClientRect();
            return ((topRect.bottom + bottomRect.bottom) / 2 - containerRect.top) / scale;
          }
        }
        return (matchRect.top - containerRect.top + matchRect.height / 2) / scale;
      };

      const finalsEl = container.querySelector(`[data-match-id="${finals[0].id}"]`);
      if (!finalsEl) return;
      const finalsRect = finalsEl.getBoundingClientRect();
      const finalsCenterY = computeMatchY(finalsEl, finalsRect);

      const drawConnector = (sources, targetX, targetY) => {
        if (sources.length === 0) return;
        const midX = (sources[0].x + targetX) / 2;
        sources.forEach(s => {
          newLines.push({ x1: s.x, y1: s.y, x2: midX, y2: s.y });
        });
        if (sources.length === 2) {
          newLines.push({ x1: midX, y1: sources[0].y, x2: midX, y2: sources[1].y });
        }
        const midY = sources.length === 2 ? (sources[0].y + sources[1].y) / 2 : sources[0].y;
        newLines.push({ x1: midX, y1: midY, x2: targetX, y2: targetY });
      };

      // West last round → Finals (left side)
      if (west.length > 0) {
        const lastWest = west[west.length - 1];
        const sources = lastWest.map(m => {
          const el = container.querySelector(`[data-match-id="${m.id}"]`);
          if (!el) return null;
          if (el.getAttribute('data-is-bye') === 'true') return null;
          const r = el.getBoundingClientRect();
          return { x: (r.right - containerRect.left) / scale, y: computeMatchY(el, r) };
        }).filter(Boolean);
        drawConnector(sources, (finalsRect.left - containerRect.left) / scale, finalsCenterY);
      }

      // East last round → Finals (right side)
      if (east.length > 0) {
        const lastEast = east[east.length - 1];
        const sources = lastEast.map(m => {
          const el = container.querySelector(`[data-match-id="${m.id}"]`);
          if (!el) return null;
          if (el.getAttribute('data-is-bye') === 'true') return null;
          const r = el.getBoundingClientRect();
          return { x: (r.left - containerRect.left) / scale, y: computeMatchY(el, r) };
        }).filter(Boolean);
        drawConnector(sources, (finalsRect.right - containerRect.left) / scale, finalsCenterY);
      }

      setLines(newLines);
    };

    const timer = setTimeout(updateLines, 80);
    const observer = new ResizeObserver(updateLines);
    observer.observe(container);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [containerRef, west, east, finals, theme, bracketStyle]);

  return (
    <svg className="absolute inset-0 pointer-events-none"
         style={{ width: '100%', height: '100%', overflow: 'visible', zIndex: 10 }}>
      {lines.map((line, i) => (
        <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke={theme.connector} strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function DoubleSidedBracket({ bracket, theme, onAdvanceWinner, bracketStyle, sizing, showSeeds }) {
  const { west, east, finals } = splitBracketForDoubleSided(bracket.rounds);
  const westRef = useRef(null);
  const eastRef = useRef(null);
  const outerRef = useRef(null);

  // Double-sided needs an explicit minHeight so flex `justify-around` has vertical room
  // to distribute matches. Without it the container collapses to the content height of
  // the Finals column (a single card), making the West/East sides look cramped.
  const totalMatches = (bracket.rounds[0] || []).length;
  const approxParticipants = totalMatches * 2;
  const dsMinHeight = Math.max(500, approxParticipants * 25);

  return (
    <div className="relative flex items-stretch gap-0" style={{ padding: '20px 0', minHeight: `${dsMinHeight}px` }} ref={outerRef}>
      <FinalsConnectors containerRef={outerRef} west={west} east={east} finals={finals} theme={theme} bracketStyle={bracketStyle} />

      {/* West side (left to right) */}
      <div className="relative flex items-stretch gap-0" ref={westRef}>
        <BracketConnectors containerRef={westRef} rounds={west} theme={theme} bracketStyle={bracketStyle} />
        {west.map((matches, roundIdx) => (
          <BracketRound
            key={`west-${roundIdx}`}
            matches={matches}
            roundIndex={roundIdx}
            totalRounds={west.length}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection="winners"
            bracketStyle={bracketStyle}
            label={getRoundLabel(roundIdx, bracket.rounds.length)}
            sizing={sizing}
            showSeeds={showSeeds}
          />
        ))}
      </div>

      {/* Finals in the center — wrapper mirrors West/East structure (flex items-stretch row)
          so the BracketRound inside stretches vertically the same way, letting its internal
          `flex-1 justify-around` align the Finals card at the same Y coordinate as the West/East
          Semifinal cards. Previously this column used `flex flex-col justify-center` plus a
          decorative "Finals" pill, which (a) duplicated the auto-rendered "Finals" label that
          BracketRound already generates via getRoundLabel(0, 1) and (b) offset the Finals card
          vertically relative to the Semifinal cards because the whole block was vertically
          centered instead of the card.
          ChampionDisplay is rendered absolutely so it doesn't consume row space — otherwise
          the flex sibling would push the East side sideways once a winner exists, breaking
          the symmetry of the double-sided layout. */}
      <div className="relative flex items-stretch gap-0 mx-4">
        <BracketRound
          matches={finals}
          roundIndex={0}
          totalRounds={1}
          theme={theme}
          onAdvanceWinner={onAdvanceWinner}
          bracketSection="winners"
          bracketStyle={bracketStyle}
          label="Finals"
          sizing={sizing}
          showSeeds={showSeeds}
        />
        {finals[0]?.winner && (
          <div className="absolute left-1/2 -translate-x-1/2 -ml-8 top-full mt-2 z-20">
            <ChampionDisplay rounds={[finals]} theme={theme} showSeeds={showSeeds} />
          </div>
        )}
      </div>

      {/* East side (right to left, reversed order) */}
      <div className="relative flex items-stretch gap-0 flex-row-reverse" ref={eastRef}>
        <BracketConnectors containerRef={eastRef} rounds={east} theme={theme} mirrored bracketStyle={bracketStyle} />
        {east.map((matches, roundIdx) => (
          <BracketRound
            key={`east-${roundIdx}`}
            matches={matches}
            roundIndex={roundIdx}
            totalRounds={east.length}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection="winners"
            bracketStyle={bracketStyle}
            label={getRoundLabel(roundIdx, bracket.rounds.length)}
            sizing={sizing}
            showSeeds={showSeeds}
          />
        ))}
      </div>
    </div>
  );
}

function DoubleBracket({ doubleBracket, theme, onAdvanceWinner, bracketStyle, sizing, showSeeds }) {
  const winnersRef = useRef(null);
  const losersRef = useRef(null);

  return (
    <div className="space-y-4">

      {/* Winners Bracket */}
      <div>
        <div
          className="inline-block text-sm font-bold uppercase tracking-wider mb-2 px-3 py-1 rounded-full"
          style={{ color: theme.accent, background: theme.accent + '15' }}
        >
          Winners Bracket
        </div>
        <div className="relative" ref={winnersRef}>
          <BracketConnectors containerRef={winnersRef} rounds={doubleBracket.winnersRounds} theme={theme} bracketStyle={bracketStyle} />
          <div className="flex items-stretch gap-0" style={{ padding: '12px 0' }}>
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
                bracketStyle={bracketStyle}
                sizing={sizing}
                showSeeds={showSeeds}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Losers Bracket */}
      <div>
        <div
          className="inline-block text-sm font-bold uppercase tracking-wider mb-2 px-3 py-1 rounded-full"
          style={{ color: theme.textMuted, background: theme.textMuted + '15' }}
        >
          Losers Bracket
        </div>
        <div className="relative" ref={losersRef}>
          <BracketConnectors containerRef={losersRef} rounds={doubleBracket.losersRounds} theme={theme} bracketStyle={bracketStyle} />
          <div className="flex items-stretch gap-0" style={{ padding: '12px 0' }}>
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
                bracketStyle={bracketStyle}
                sizing={sizing}
                showSeeds={showSeeds}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Grand Finals */}
      <div>
        <div
          className="inline-block text-sm font-bold uppercase tracking-wider mb-2 px-3 py-1 rounded-full"
          style={{ color: theme.accent, background: theme.accent + '15' }}
        >
          Grand Finals
        </div>
        <div className="flex items-center gap-4 py-2">
          <BracketRound
            matches={doubleBracket.grandFinals}
            roundIndex={0}
            totalRounds={1}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection="grandFinals"
            label="Grand Finals"
            bracketStyle={bracketStyle}
            sizing={sizing}
            showSeeds={showSeeds}
          />
        </div>
      </div>
    </div>
  );
}

export default function BracketView({ bracket, doubleBracket, bracketType, bracketStyle, layout, theme, title, logo, onAdvanceWinner, showSeeds }) {
  // Use effective match count for sizing (skip bye-dominated first rounds)
  const allRounds = bracket?.rounds || doubleBracket?.winnersRounds || [];
  const firstRound = allRounds[0] || [];
  const byeCount = firstRound.filter(m => m.isBye).length;
  const effectiveCount = byeCount > firstRound.length / 2 && allRounds[1]
    ? allRounds[1].length
    : firstRound.length || 4;
  const sizing = computeBracketSizing(effectiveCount, layout);
  // Auto-scale thresholds:
  // - Double-sided splits the bracket into west/east halves, so its natural width for N
  //   teams is similar to a standard bracket for N/2 teams. DS brackets still overflow the
  //   viewport past a certain size (even though they're narrower than Standard at the same
  //   team count) because the halves plus finals still exceed the available width — so DS
  //   gets auto-scale one bucket larger than Standard to keep it viewable without scroll.
  // - Standard layout: unchanged (scale up to 16 teams, scroll beyond).
  const shouldAutoScale = layout === 'double-sided'
    ? effectiveCount <= 16
    : effectiveCount <= 8;

  return (
    <div
      className="bracket-container rounded-2xl overflow-hidden"
      style={{
        background: theme.bg,
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      {/* Bracket Header */}
      <div
        className="bracket-export-header flex items-center gap-3 px-6 py-4 border-b"
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
      <div className={`p-6 ${shouldAutoScale ? '' : 'overflow-x-auto bracket-scroll'}`}>
        <AutoScaleWrapper enabled={shouldAutoScale}>
          {bracketType === 'single' && bracket && layout === 'double-sided' && (
            <DoubleSidedBracket bracket={bracket} theme={theme} onAdvanceWinner={onAdvanceWinner} bracketStyle={bracketStyle} sizing={sizing} showSeeds={showSeeds} />
          )}
          {bracketType === 'single' && bracket && layout !== 'double-sided' && (
            <SingleBracket bracket={bracket} theme={theme} onAdvanceWinner={onAdvanceWinner} bracketStyle={bracketStyle} sizing={sizing} showSeeds={showSeeds} />
          )}
          {bracketType === 'double' && doubleBracket && (
            <DoubleBracket doubleBracket={doubleBracket} theme={theme} onAdvanceWinner={onAdvanceWinner} bracketStyle={bracketStyle} sizing={sizing} showSeeds={showSeeds} />
          )}
        </AutoScaleWrapper>
      </div>
    </div>
  );
}
