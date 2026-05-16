import { useState, useCallback, useRef, useEffect } from 'react';
import { Level } from '../types';
import './Grid.css';

interface GridProps {
  level: Level;
  onCellClick?: (row: number, col: number) => void;
  onCellDrag?: (row: number, col: number) => void;
  onEdgeClick?: (row: number, col: number, side: 'top' | 'left') => void;
  edgeMode?: boolean;
  highlightPlayer?: boolean;
}

export default function Grid({ level, onCellClick, onCellDrag, onEdgeClick, edgeMode, highlightPlayer }: GridProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Responsive cell sizing: measure the wrapper and fill available space.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setBox({ w: cr.width, h: cr.height });
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  // Cap max cell size to 72 so small maps don't dominate the screen.
  // Also reserve a comfortable outer margin (~8% of the smaller box dimension).
  const cellSize = (level.width > 0 && level.height > 0 && box.w > 0 && box.h > 0)
    ? Math.max(16, Math.min(72, Math.floor(Math.min(
        (box.w * 0.92) / level.width,
        (box.h * 0.92) / level.height
      ))))
    : 40;

  const handleMouseDown = useCallback((row: number, col: number) => {
    setIsDragging(true);
    onCellClick?.(row, col);
  }, [onCellClick]);

  const handleMouseEnter = useCallback((row: number, col: number) => {
    if (isDragging) {
      (onCellDrag ?? onCellClick)?.(row, col);
    }
  }, [isDragging, onCellDrag, onCellClick]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (level.width === 0 || level.height === 0) {
    return <div ref={wrapperRef} className="grid-wrapper" />;
  }

  const gridW = cellSize * level.width;
  const gridH = cellSize * level.height;

  // Edge hit dimensions. Strip is thick perpendicular to the edge for easy
  // clicking, but trimmed at both ends so it never enters the corner squares
  // shared with perpendicular edges — preventing the "selecting corners" feel.
  const hitThick = Math.max(14, Math.min(22, Math.round(cellSize * 0.3)));
  const cornerTrim = hitThick / 2 + 2;
  const archThick = Math.max(5, Math.round(cellSize * 0.16));

  // Enumerate interior edges.
  const horzEdges: { row: number; col: number; level: number }[] = [];
  for (let r = 1; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      horzEdges.push({ row: r, col: c, level: level.tiles[r][c].edgeArchTop ?? 0 });
    }
  }
  const vertEdges: { row: number; col: number; level: number }[] = [];
  for (let r = 0; r < level.height; r++) {
    for (let c = 1; c < level.width; c++) {
      vertEdges.push({ row: r, col: c, level: level.tiles[r][c].edgeArchLeft ?? 0 });
    }
  }

  return (
    <div ref={wrapperRef} className="grid-wrapper">
      <div className="grid-stack" style={{ position: 'relative', width: gridW, height: gridH }}>
        <div
          className={`grid ${edgeMode ? 'edge-mode' : ''}`}
          style={{
            gridTemplateColumns: `repeat(${level.width}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${level.height}, ${cellSize}px)`,
          }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {Array.from({ length: level.height }, (_, row) =>
            Array.from({ length: level.width }, (_, col) => {
              const tile = level.tiles[row][col];
              const obj = level.objects[row][col];

              const tileClasses = [
                'grid-cell',
                tile.isWarm ? 'warm' : 'cool',
                tile.isShade ? 'shaded' : '',
                tile.isFlake ? 'flake' : '',
                tile.isGoal ? 'goal' : '',
                tile.isRowArch ? 'row-arch' : '',
                tile.isColumnArch ? 'col-arch' : '',
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={`${row}-${col}`}
                  className={tileClasses}
                  onMouseDown={() => handleMouseDown(row, col)}
                  onMouseEnter={() => handleMouseEnter(row, col)}
                  style={{ width: cellSize, height: cellSize, position: 'relative' }}
                >
                  {tile.isGoal && <GoalOverlay size={cellSize} />}
                  {tile.isFlake && !obj && <FlakeOverlay size={cellSize} />}
                  {(tile.isRowArch || tile.isColumnArch) && (
                    <TunnelOverlay size={cellSize} isRow={tile.isRowArch} />
                  )}
                  {obj && (
                    <div className={`object obj-${obj.type} size-${obj.size} ${highlightPlayer && obj.type === 'player' ? 'player-highlight' : ''} ${obj.isMelting ? 'melting' : ''}`}>
                      {renderObject(obj, cellSize)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Arch visuals overlay (absolute pixel positioning over the grid) */}
        <div className="edge-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {horzEdges.filter(e => e.level > 0).map(e => (
            <ArchSegment key={`ah-${e.row}-${e.col}`}
              left={e.col * cellSize}
              top={e.row * cellSize - archThick / 2}
              width={cellSize}
              height={archThick}
              level={e.level}
              orientation="horizontal" />
          ))}
          {vertEdges.filter(e => e.level > 0).map(e => (
            <ArchSegment key={`av-${e.row}-${e.col}`}
              left={e.col * cellSize - archThick / 2}
              top={e.row * cellSize}
              width={archThick}
              height={cellSize}
              level={e.level}
              orientation="vertical" />
          ))}
        </div>

        {/* Edge hit strips — strictly on edges, never on corners */}
        {edgeMode && (
          <div className="edge-hits" style={{ position: 'absolute', inset: 0 }}>
            {horzEdges.map(e => (
              <div key={`hh-${e.row}-${e.col}`} className="edge-hit edge-hit-h"
                style={{
                  position: 'absolute',
                  left: e.col * cellSize + cornerTrim,
                  top: e.row * cellSize - hitThick / 2,
                  width: Math.max(0, cellSize - 2 * cornerTrim),
                  height: hitThick,
                }}
                onClick={(ev) => { ev.stopPropagation(); onEdgeClick?.(e.row, e.col, 'top'); }} />
            ))}
            {vertEdges.map(e => (
              <div key={`vh-${e.row}-${e.col}`} className="edge-hit edge-hit-v"
                style={{
                  position: 'absolute',
                  left: e.col * cellSize - hitThick / 2,
                  top: e.row * cellSize + cornerTrim,
                  width: hitThick,
                  height: Math.max(0, cellSize - 2 * cornerTrim),
                }}
                onClick={(ev) => { ev.stopPropagation(); onEdgeClick?.(e.row, e.col, 'left'); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArchSegment({ left, top, width, height, level, orientation }: {
  left: number; top: number; width: number; height: number; level: number; orientation: 'horizontal' | 'vertical';
}) {
  // Height-1 arch: gold single bar. Height-2 arch: deeper copper double bar so
  // it reads as taller / more permissive at a glance.
  const isH = orientation === 'horizontal';
  const barColor = level === 2 ? '#d96b3e' : '#c9a44a';
  const capColor = level === 2 ? '#7a3a1c' : '#8a6a26';
  return (
    <div style={{ position: 'absolute', left, top, width, height, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        left: isH ? '4%' : '50%',
        top: isH ? '50%' : '4%',
        transform: isH ? 'translateY(-50%)' : 'translateX(-50%)',
        width: isH ? '92%' : '40%',
        height: isH ? '40%' : '92%',
        background: barColor,
        borderRadius: 2,
      }} />
      {level === 2 && (
        <div style={{
          position: 'absolute',
          left: isH ? '4%' : '50%',
          top: isH ? '50%' : '4%',
          transform: isH
            ? 'translate(0, calc(-50% - 4px))'
            : 'translate(calc(-50% + 4px), 0)',
          width: isH ? '92%' : '24%',
          height: isH ? '24%' : '92%',
          background: barColor,
          opacity: 0.65,
          borderRadius: 2,
        }} />
      )}
      <div style={{
        position: 'absolute',
        left: isH ? 0 : '50%',
        top: isH ? '50%' : 0,
        transform: isH ? 'translateY(-50%)' : 'translateX(-50%)',
        width: isH ? '5%' : '60%',
        height: isH ? '60%' : '5%',
        background: capColor,
        borderRadius: 1,
      }} />
      <div style={{
        position: 'absolute',
        left: isH ? '95%' : '50%',
        top: isH ? '50%' : '95%',
        transform: isH ? 'translateY(-50%)' : 'translateX(-50%)',
        width: isH ? '5%' : '60%',
        height: isH ? '60%' : '5%',
        background: capColor,
        borderRadius: 1,
      }} />
    </div>
  );
}

function GoalOverlay({ size }: { size: number }) {
  return (
    <svg className="tile-overlay goal-overlay" width={size} height={size} viewBox="0 0 40 40">
      <defs>
        <radialGradient id="goal-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#50e880" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#30c060" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#20a050" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="url(#goal-glow)" />
      <polygon points="20,6 23.5,15 33,15 25.5,21 28,30 20,25 12,30 14.5,21 7,15 16.5,15"
        fill="none" stroke="#3cb868" strokeWidth="1.3" opacity="0.55" />
      <polygon points="20,10 22.5,16 29,16 24,20.5 26,27 20,23 14,27 16,20.5 11,16 17.5,16"
        fill="#40d870" opacity="0.3" />
    </svg>
  );
}

function FlakeOverlay({ size }: { size: number }) {
  return (
    <svg className="tile-overlay flake-overlay" width={size} height={size} viewBox="0 0 40 40">
      <g transform="translate(20,20)" stroke="#4a90d9" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7">
        {[0, 60, 120].map(angle => (
          <g key={angle} transform={`rotate(${angle})`}>
            <line x1="0" y1="-10" x2="0" y2="10" />
            <line x1="0" y1="-7" x2="-3" y2="-10" />
            <line x1="0" y1="-7" x2="3" y2="-10" />
            <line x1="0" y1="7" x2="-3" y2="10" />
            <line x1="0" y1="7" x2="3" y2="10" />
          </g>
        ))}
        <circle cx="0" cy="0" r="1.5" fill="#4a90d9" stroke="none" />
      </g>
    </svg>
  );
}

function TunnelOverlay({ size, isRow }: { size: number; isRow: boolean }) {
  return (
    <svg className="tile-overlay arch-overlay" width={size} height={size} viewBox="0 0 40 40">
      {isRow ? (
        <g>
          <rect x="3" y="0" width="4" height="40" fill="#6a6a80" rx="1.5" opacity="0.7" />
          <rect x="33" y="0" width="4" height="40" fill="#6a6a80" rx="1.5" opacity="0.7" />
          <path d="M3,4 Q20,-4 37,4" fill="none" stroke="#6a6a80" strokeWidth="2.5" opacity="0.7" />
          <line x1="18" y1="16" x2="22" y2="16" stroke="#8888aa" strokeWidth="1" opacity="0.5" />
          <line x1="20" y1="14" x2="20" y2="18" stroke="#8888aa" strokeWidth="1" opacity="0.5" />
          <line x1="18" y1="24" x2="22" y2="24" stroke="#8888aa" strokeWidth="1" opacity="0.5" />
          <line x1="20" y1="22" x2="20" y2="26" stroke="#8888aa" strokeWidth="1" opacity="0.5" />
        </g>
      ) : (
        <g>
          <rect x="0" y="3" width="40" height="4" fill="#6a6a80" rx="1.5" opacity="0.7" />
          <rect x="0" y="33" width="40" height="4" fill="#6a6a80" rx="1.5" opacity="0.7" />
          <path d="M4,3 Q-4,20 4,37" fill="none" stroke="#6a6a80" strokeWidth="2.5" opacity="0.7" />
          <line x1="16" y1="18" x2="16" y2="22" stroke="#8888aa" strokeWidth="1" opacity="0.5" />
          <line x1="14" y1="20" x2="18" y2="20" stroke="#8888aa" strokeWidth="1" opacity="0.5" />
          <line x1="24" y1="18" x2="24" y2="22" stroke="#8888aa" strokeWidth="1" opacity="0.5" />
          <line x1="22" y1="20" x2="26" y2="20" stroke="#8888aa" strokeWidth="1" opacity="0.5" />
        </g>
      )}
    </svg>
  );
}

function renderObject(obj: { type: string; size: number; isMelting: boolean; treeHeight?: number }, cellSize: number) {
  const s = cellSize * 0.85;
  switch (obj.type) {
    case 'player': {
      const scale = obj.size === 1 ? 0.65 : obj.size === 2 ? 0.85 : 1;
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <g transform={`translate(20,22) scale(${scale}) translate(-20,-22)`}>
            <circle cx="20" cy="27" r="9" fill="#fff" stroke="#456" strokeWidth="1.5" />
            <circle cx="20" cy="15" r="6.5" fill="#fff" stroke="#456" strokeWidth="1.5" />
            <circle cx="17.5" cy="14" r="1.3" fill="#111" />
            <circle cx="22.5" cy="14" r="1.3" fill="#111" />
            <line x1="14" y1="20" x2="8" y2="16" stroke="#654" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="26" y1="20" x2="32" y2="16" stroke="#654" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          {obj.isMelting && <g className="melting-sweat">
            <ellipse cx="7" cy="20" rx="2.5" ry="4" fill="#3cc8ff" opacity="0.9" />
            <circle cx="7" cy="16.5" r="2" fill="#3cc8ff" opacity="0.9" />
            <ellipse cx="33" cy="22" rx="2.5" ry="4" fill="#3cc8ff" opacity="0.8" />
            <circle cx="33" cy="18.5" r="2" fill="#3cc8ff" opacity="0.8" />
            <ellipse cx="15" cy="33" rx="2" ry="3" fill="#3cc8ff" opacity="0.7" />
            <circle cx="15" cy="30.5" r="1.6" fill="#3cc8ff" opacity="0.7" />
          </g>}
          <text x="34" y="10" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#345" opacity="0.8">{obj.size}</text>
        </svg>
      );
    }
    case 'snowball': {
      const r = obj.size === 1 ? 10 : 14;
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={r} fill="#e8f0ff" stroke="#99b" strokeWidth="1.2" />
        </svg>
      );
    }
    case 'snowman': {
      const scale = obj.size === 1 ? 0.65 : obj.size === 2 ? 0.85 : 1;
      const filterId = `snowman-glow-${Math.random().toString(36).slice(2, 6)}`;
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <defs>
            <filter id={filterId}>
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g transform={`translate(20,22) scale(${scale}) translate(-20,-22)`}>
            <circle cx="20" cy="27" r="9" fill="#e0eaff" stroke="#6af" strokeWidth="1.8" filter={`url(#${filterId})`} />
            <circle cx="20" cy="15" r="6.5" fill="#e0eaff" stroke="#6af" strokeWidth="1.8" filter={`url(#${filterId})`} />
          </g>
          <text x="34" y="10" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#46a" opacity="0.8">{obj.size}</text>
        </svg>
      );
    }
    case 'block':
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <rect x="6" y="6" width="28" height="28" fill="#8b6914" stroke="#5a4510" strokeWidth="1.5" rx="2" />
        </svg>
      );
    case 'wall':
      return (
        <svg width={cellSize} height={cellSize} viewBox="0 0 40 40">
          <rect x="0" y="0" width="40" height="40" fill="#666" />
          <line x1="0" y1="20" x2="40" y2="20" stroke="#555" strokeWidth="1" />
          <line x1="20" y1="0" x2="20" y2="20" stroke="#555" strokeWidth="1" />
          <line x1="10" y1="20" x2="10" y2="40" stroke="#555" strokeWidth="1" />
          <line x1="30" y1="20" x2="30" y2="40" stroke="#555" strokeWidth="1" />
          <rect x="0" y="0" width="40" height="40" fill="none" stroke="#444" strokeWidth="1" />
        </svg>
      );
    case 'tree': {
      const h = obj.treeHeight ?? 1;
      const hLabel = h % 1 === 0 ? h.toString() : h.toFixed(1);
      return (
        <svg width={s} height={s} viewBox="0 0 40 40">
          <polygon points="20,4 32,32 8,32" fill="#2d7a2d" stroke="#1a5a1a" strokeWidth="1" />
          <rect x="17" y="32" width="6" height="6" fill="#5a3a1a" />
          <text x="20" y="22" textAnchor="middle" fontSize="8" fill="#fff">{hLabel}</text>
        </svg>
      );
    }
    default:
      return null;
  }
}
