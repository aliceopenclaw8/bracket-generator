import { useEffect, useState } from 'react';

export default function BracketConnectors({ containerRef, rounds, theme, mirrored = false, bracketStyle }) {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateLines = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      // Account for CSS transform scale (AutoScaleWrapper)
      const scaleEl = container.closest('[data-auto-scale]');
      const scale = scaleEl ? parseFloat(scaleEl.dataset.autoScale) || 1 : 1;
      const newLines = [];

      // Line style: anchor at midpoint between the two team slot underlines.
      // Boxed style: anchor at vertical midpoint of the card.
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

      // For each round after the first, connect matches to their feeder matches
      for (let r = 1; r < rounds.length; r++) {
        for (let m = 0; m < rounds[r].length; m++) {
          const matchEl = container.querySelector(`[data-match-id="${rounds[r][m].id}"]`);
          if (!matchEl) continue;

          const matchRect = matchEl.getBoundingClientRect();
          const targetX = mirrored
            ? (matchRect.right - containerRect.left) / scale
            : (matchRect.left - containerRect.left) / scale;
          const targetY = computeMatchY(matchEl, matchRect);

          // Detect merge round (same count = 1:1) vs reduce round (halved = 2:1)
          const isMergeRound = rounds[r].length === rounds[r - 1].length;
          const sourceIndices = isMergeRound ? [m] : [m * 2, m * 2 + 1];

          const sources = sourceIndices
            .filter(idx => idx < rounds[r - 1].length)
            .map(idx => {
              const el = container.querySelector(`[data-match-id="${rounds[r - 1][idx].id}"]`);
              if (!el) return null;
              // Skip drawing connectors from bye source matches — they have no real team
              // matchup, so the line would look like it's floating from nowhere.
              if (el.getAttribute('data-is-bye') === 'true') return null;
              const rect = el.getBoundingClientRect();
              return {
                x: mirrored
                  ? (rect.left - containerRect.left) / scale
                  : (rect.right - containerRect.left) / scale,
                y: computeMatchY(el, rect),
              };
            })
            .filter(Boolean);

          if (sources.length === 0) continue;

          const midX = (sources[0].x + targetX) / 2;

          sources.forEach((source) => {
            // Horizontal from source to mid
            newLines.push({
              x1: source.x,
              y1: source.y,
              x2: midX,
              y2: source.y,
            });
          });

          if (sources.length === 2) {
            // Vertical connector between the two sources at midX
            newLines.push({
              x1: midX,
              y1: sources[0].y,
              x2: midX,
              y2: sources[1].y,
            });
          }

          // Connect midpoint to target with right-angle lines (never diagonal)
          const midY = sources.length === 2
            ? (sources[0].y + sources[1].y) / 2
            : sources[0].y;

          if (Math.abs(midY - targetY) > 1) {
            // Vertical from midY to targetY, then horizontal to target
            newLines.push({ x1: midX, y1: midY, x2: midX, y2: targetY });
            newLines.push({ x1: midX, y1: targetY, x2: targetX, y2: targetY });
          } else {
            // Straight horizontal to target
            newLines.push({ x1: midX, y1: midY, x2: targetX, y2: targetY });
          }
        }
      }

      setLines(newLines);
    };

    // Initial draw + observe resize
    const timer = setTimeout(updateLines, 50);
    const observer = new ResizeObserver(updateLines);
    observer.observe(containerRef.current);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [containerRef, rounds, theme, mirrored, bracketStyle]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible', zIndex: 10 }}
    >
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={theme.connector}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
