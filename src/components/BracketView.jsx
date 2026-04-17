import { useRef, useEffect, useState } from 'react';
import BracketRound from './BracketRound';
import BracketConnectors from './BracketConnectors';
import { Pill } from './MatchCard';
import { getRoundLabel, splitBracketForDoubleSided } from '../utils/bracketLogic';

function computeBracketSizing(firstRoundMatchCount, layout, bracketType) {
  // Compact padY is OK since overflow-hidden was removed from cards. The +8 paddingBottom
  // in TeamSlot and SVG SeedBadge baseline positioning handle descender rendering.
  // >16 tiers use wide roundW and tight padY so large brackets (64-team) fill
  // A4 landscape. Without this, 32+ stacked match cards make the bracket too tall.
  if (layout === 'double-sided') {
    if (firstRoundMatchCount <= 4) return { cardW: 200, padY: 14, baseGap: 48, roundW: 240 };
    if (firstRoundMatchCount <= 8) return { cardW: 170, padY: 10, baseGap: 12, roundW: 200 };
    if (firstRoundMatchCount <= 16) return { cardW: 150, padY: 8, baseGap: 6, roundW: 180 };
    return { cardW: 150, padY: 3, baseGap: 2, roundW: 240 };
  }
  if (bracketType === 'double') {
    if (firstRoundMatchCount <= 4) return { cardW: 200, padY: 12, baseGap: 32, roundW: 240 };
    if (firstRoundMatchCount <= 8) return { cardW: 180, padY: 10, baseGap: 16, roundW: 210 };
    if (firstRoundMatchCount <= 16) return { cardW: 160, padY: 9, baseGap: 10, roundW: 190 };
    return { cardW: 140, padY: 4, baseGap: 3, roundW: 220 };
  }
  if (firstRoundMatchCount <= 2) return { cardW: 300, padY: 55, baseGap: 100, roundW: 420 };
  if (firstRoundMatchCount <= 4) return { cardW: 280, padY: 42, baseGap: 72, roundW: 380 };
  if (firstRoundMatchCount <= 8) return { cardW: 220, padY: 12, baseGap: 32, roundW: 340 };
  if (firstRoundMatchCount <= 16) return { cardW: 200, padY: 10, baseGap: 16, roundW: 300 };
  return { cardW: 200, padY: 3, baseGap: 3, roundW: 400 };
}

function AutoScaleWrapper({ children }) {
  const wrapperRef = useRef(null);
  const contentRef = useRef(null);
  const [dims, setDims] = useState({ scale: 1, stretchW: 0, stretchH: 0, ready: false });

  useEffect(() => {
    const content = contentRef.current;
    const wrapper = wrapperRef.current;
    if (!content || !wrapper) return;

    const update = () => {
      const naturalW = content.scrollWidth;
      const naturalH = content.scrollHeight;
      const availW = wrapper.clientWidth;
      const availH = wrapper.clientHeight;

      if (naturalW <= 0 || naturalH <= 0 || availW <= 0 || availH <= 0) return;

      // Stretch natural dimensions to match A4 aspect so uniform scaling fills
      // both axes without distorting text — the bracket's flex layout
      // redistributes children into the enlarged box.
      const targetAspect = availW / availH;
      let stretchW = naturalW;
      let stretchH = naturalH;
      if (naturalW / naturalH > targetAspect) {
        stretchH = naturalW / targetAspect;
      } else {
        stretchW = naturalH * targetAspect;
      }

      // Cap upscale at 2x; allow unlimited downscale so large brackets still fit A4.
      const s = Math.min(2, availW / stretchW, availH / stretchH);
      setDims(prev => {
        // Ignore sub-pixel jitter to stop ResizeObserver ping-pong at the aspect boundary.
        if (prev.ready &&
            Math.abs(prev.stretchW - stretchW) < 2 &&
            Math.abs(prev.stretchH - stretchH) < 2 &&
            Math.abs(prev.scale - s) < 0.005) {
          return prev;
        }
        return { scale: s, stretchW, stretchH, ready: true };
      });
    };

    const timer = setTimeout(update, 80);
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    ro.observe(content); // Also observe content so scale recalculates when bracket changes size

    return () => { clearTimeout(timer); ro.disconnect(); };
  }, []);

  const { scale, stretchW, stretchH, ready } = dims;

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <div
        ref={contentRef}
        data-auto-scale={scale}
        style={{
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          width: 'max-content',
          minWidth: `${stretchW}px`,
          minHeight: `${stretchH}px`,
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.2s',
          marginRight: `${stretchW * (scale - 1)}px`,
          marginBottom: `${stretchH * (scale - 1)}px`,
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

function SingleBracket({ bracket, theme, onAdvanceWinner, sizing, showSeeds, bracketStyle }) {
  const containerRef = useRef(null);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <BracketConnectors containerRef={containerRef} rounds={bracket.rounds} theme={theme} bracketStyle={bracketStyle} />
      <div className="flex items-stretch justify-around w-full h-full" style={{ padding: '20px 0' }}>
        {bracket.rounds.map((matches, roundIdx) => (
          <BracketRound
            key={roundIdx}
            matches={matches}
            roundIndex={roundIdx}
            totalRounds={bracket.rounds.length}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection="winners"
            sizing={sizing}
            showSeeds={showSeeds}
            isChampionship={roundIdx === bracket.rounds.length - 1 && matches.length === 1}
            bracketStyle={bracketStyle}
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

      const finalsEl = container.querySelector(`[data-match-id="${finals[0].id}"]`);
      if (!finalsEl) return;
      const finalsRect = finalsEl.getBoundingClientRect();

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
          return {
            x: (r.right - containerRect.left) / scale,
            y: computeMatchY(el, r),
          };
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
          return {
            x: (r.left - containerRect.left) / scale,
            y: computeMatchY(el, r),
          };
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

function DoubleSidedBracket({ bracket, theme, onAdvanceWinner, sizing, showSeeds, bracketStyle }) {
  const { west, east, finals } = splitBracketForDoubleSided(bracket.rounds);
  const westRef = useRef(null);
  const eastRef = useRef(null);
  const outerRef = useRef(null);

  return (
    <div className="relative flex items-stretch justify-around w-full h-full" style={{ padding: '20px 0' }} ref={outerRef}>
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
            label={getRoundLabel(roundIdx, bracket.rounds.length)}
            sizing={sizing}
            showSeeds={showSeeds}
            bracketStyle={bracketStyle}
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
          label="Finals"
          sizing={sizing}
          showSeeds={showSeeds}
          isChampionship
          bracketStyle={bracketStyle}
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
            label={getRoundLabel(roundIdx, bracket.rounds.length)}
            sizing={sizing}
            showSeeds={showSeeds}
            bracketStyle={bracketStyle}
          />
        ))}
      </div>
    </div>
  );
}

function DoubleBracket({ doubleBracket, theme, onAdvanceWinner, sizing, showSeeds, bracketStyle }) {
  const winnersRef = useRef(null);
  const losersRef = useRef(null);
  const outerRef = useRef(null);

  // Losers bracket uses smaller cards for visual hierarchy (minimum 140px for legibility)
  const losersSizing = {
    cardW: Math.max(140, Math.round(sizing.cardW * 0.7)),
    padY: Math.max(3, Math.round(sizing.padY * 0.65)),
    baseGap: sizing.baseGap,
    roundW: Math.max(168, Math.round(sizing.roundW * 0.7)),
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Section labels */}
      <div className="flex justify-between items-center mb-1 px-1 shrink-0">
        <Pill text="Winners Bracket" color={theme.accent} bg={theme.accent + '15'} fontSize={12} paddingX={14} />
        <Pill text="Losers Bracket" color={theme.textMuted} bg={theme.textMuted + '15'} fontSize={12} paddingX={14} />
      </div>

      {/* Side-by-side: Winners (L→R) | GF (center) | Losers (R→L) */}
      <div className="relative flex items-stretch justify-around flex-1 w-full"
           style={{ padding: '12px 0' }}
           ref={outerRef}>

        <FinalsConnectors
          containerRef={outerRef}
          west={doubleBracket.winnersRounds}
          east={doubleBracket.losersRounds}
          finals={doubleBracket.grandFinals}
          theme={theme}
          bracketStyle={bracketStyle}
        />

        {/* Winners bracket (left to right) */}
        <div className="relative flex items-stretch gap-0" ref={winnersRef}>
          <BracketConnectors containerRef={winnersRef} rounds={doubleBracket.winnersRounds} theme={theme} bracketStyle={bracketStyle} />
          {doubleBracket.winnersRounds.map((matches, roundIdx) => (
            <BracketRound
              key={`w-${roundIdx}`}
              matches={matches}
              roundIndex={roundIdx}
              totalRounds={doubleBracket.winnersRounds.length}
              theme={theme}
              onAdvanceWinner={onAdvanceWinner}
              bracketSection="winners"
              label={getRoundLabel(roundIdx, doubleBracket.winnersRounds.length)}
              sizing={sizing}
              showSeeds={showSeeds}
              bracketStyle={bracketStyle}
            />
          ))}
        </div>

        {/* Grand Finals (center) */}
        <div className="relative flex items-stretch gap-0 mx-4">
          <BracketRound
            matches={doubleBracket.grandFinals}
            roundIndex={0}
            totalRounds={1}
            theme={theme}
            onAdvanceWinner={onAdvanceWinner}
            bracketSection="grandFinals"
            label="Grand Finals"
            sizing={sizing}
            showSeeds={showSeeds}
            isChampionship
            bracketStyle={bracketStyle}
          />
        </div>

        {/* Losers bracket (right to left, mirrored) */}
        <div className="relative flex items-stretch gap-0 flex-row-reverse" ref={losersRef}>
          <BracketConnectors containerRef={losersRef} rounds={doubleBracket.losersRounds} theme={theme} mirrored bracketStyle={bracketStyle} />
          {doubleBracket.losersRounds.map((matches, roundIdx) => (
            <BracketRound
              key={`l-${roundIdx}`}
              matches={matches}
              roundIndex={roundIdx}
              totalRounds={doubleBracket.losersRounds.length}
              theme={theme}
              onAdvanceWinner={onAdvanceWinner}
              bracketSection="losers"
              label={`Losers R${roundIdx + 1}`}
              sizing={losersSizing}
              showSeeds={showSeeds}
              bracketStyle={bracketStyle}
            />
          ))}
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
  const sizing = computeBracketSizing(effectiveCount, layout, bracketType);

  return (
    <div
      className="bracket-container rounded-2xl overflow-hidden mx-auto flex flex-col"
      style={{
        background: theme.bg,
        border: `1px solid ${theme.cardBorder}`,
        aspectRatio: '297 / 210', // A4 landscape — preview = print preview
        height: 'calc(100vh - 160px)', // fit in one screen (header + toolbar ~160px)
        maxWidth: '100%', // shrink width on narrow screens while keeping ratio
      }}
    >
      {/* Bracket Header */}
      <div
        className="bracket-export-header flex items-center gap-3 px-6 py-4 border-b shrink-0"
        style={{ borderColor: theme.cardBorder, background: theme.headerBg }}
      >
        {logo && (
          <img src={logo} alt="Logo" className="w-8 h-8 rounded object-cover" />
        )}
        <h2 className="text-xl font-bold" style={{ color: theme.text }}>
          {title}
        </h2>
        <div className="ml-auto">
          <Pill
            text={bracketType === 'single' ? 'Single Elimination' : 'Double Elimination'}
            color={theme.accent}
            bg={theme.accent + '22'}
            fontSize={11}
            paddingX={14}
          />
        </div>
      </div>

      {/* Fills remaining A4 height; overflow-hidden is a safety net — AutoScaleWrapper normally keeps content in-box. */}
      <div className="p-6 flex-1 min-h-0 overflow-hidden">
        <AutoScaleWrapper>
          {bracketType === 'single' && bracket && layout === 'double-sided' && (
            <DoubleSidedBracket bracket={bracket} theme={theme} onAdvanceWinner={onAdvanceWinner} sizing={sizing} showSeeds={showSeeds} bracketStyle={bracketStyle} />
          )}
          {bracketType === 'single' && bracket && layout !== 'double-sided' && (
            <SingleBracket bracket={bracket} theme={theme} onAdvanceWinner={onAdvanceWinner} sizing={sizing} showSeeds={showSeeds} bracketStyle={bracketStyle} />
          )}
          {bracketType === 'double' && doubleBracket && (
            <DoubleBracket doubleBracket={doubleBracket} theme={theme} onAdvanceWinner={onAdvanceWinner} sizing={sizing} showSeeds={showSeeds} bracketStyle={bracketStyle} />
          )}
        </AutoScaleWrapper>
      </div>
    </div>
  );
}
