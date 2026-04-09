import { useEffect, useRef, useState } from 'react';

export default function BracketConnectors({ containerRef, rounds, theme }) {
  const [lines, setLines] = useState([]);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateLines = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newLines = [];

      // For each round after the first, connect matches to their feeder matches
      for (let r = 1; r < rounds.length; r++) {
        for (let m = 0; m < rounds[r].length; m++) {
          const matchEl = container.querySelector(`[data-match-id="${rounds[r][m].id}"]`);
          if (!matchEl) continue;

          const matchRect = matchEl.getBoundingClientRect();
          const targetX = matchRect.left - containerRect.left;
          const targetY = matchRect.top - containerRect.top + matchRect.height / 2;

          // Two source matches
          const sourceIdx1 = m * 2;
          const sourceIdx2 = m * 2 + 1;

          const sources = [sourceIdx1, sourceIdx2]
            .filter(idx => idx < rounds[r - 1].length)
            .map(idx => {
              const el = container.querySelector(`[data-match-id="${rounds[r - 1][idx].id}"]`);
              if (!el) return null;
              const rect = el.getBoundingClientRect();
              return {
                x: rect.right - containerRect.left,
                y: rect.top - containerRect.top + rect.height / 2,
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

          // Horizontal from mid to target
          const midY = sources.length === 2
            ? (sources[0].y + sources[1].y) / 2
            : sources[0].y;

          newLines.push({
            x1: midX,
            y1: midY,
            x2: targetX,
            y2: targetY,
          });
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
  }, [containerRef, rounds, theme]);

  return (
    <svg
      ref={svgRef}
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
