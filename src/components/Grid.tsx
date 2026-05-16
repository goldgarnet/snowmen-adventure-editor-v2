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

  // Minimum cell size 16, maximum 96. Subtract a tiny margin for borders.
  // Cap max cell size to 72 so small maps don't dominate the screen.
  // Also reserve a comfortable outer margin (~12% of the smaller box dimension).
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

  return (
    <div ref={wrapperRef} className="grid-wrapper">
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

          // Determine which edges of this cell carry arches (top/left only stored here)
          const topArch = !!tile.edgeArchTop;
          const leftArch = !!tile.edgeArchLeft;

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

              {/* Edge arch rendering (top edge of this cell, left edge of this cell) */}
              {topArch && row > 0 && <EdgeArchTop cellSize={cellSize} />}
              {leftArch && col > 0 && <EdgeArchLeft cellSize={cellSize} />}

              {/* Edge click strips (in edge-mode) */}
              {edgeMode && (
                <>
                  {row > 0 && (
                    <div className="edge-hit edge-hit-top"
                      onClick={(e) => { e.stopPropagation(); onEdgeClick?.(row, col, 'top'); }} />
                  )}
                  {col > 0 && (
                    <div className="edge-hit edge-hit-left"
                      onClick={(e) => { e.stopPropagation(); onEdgeClick?.(row, col, 'left'); }} />
                  )}
                  {/* Bottom edge = top edge of (row+1, col) */}
                  {row < level.height - 1 && (
                    <div className="edge-hit edge-hit-bottom"
                      onClick={(e) => { e.stopPropagation(); onEdgeClick?.(row + 1, col, 'top'); }} />
                  )}
                  {/* Right edge = left edge of (row, col+1) */}
                  {col < level.width - 1 && (
                    <div className="edge-hit edge-hit-right"
                      onClick={(e) => { e.stopPropagation(); onEdgeClick?.(row, col + 1, 'left'); }} />
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </div>
    </div>
  );
}

function EdgeArchTop({ cellSize }: { cellSize: number }) {
  // Horizontal edge: the visual sits straddling the top boundary of this cell
  const t = Math.max(4, cellSize * 0.12);
  return (
    <svg className="edge-arch edge-arch-top" width={cellSize} height={t}
      style={{ position: 'absolute', top: -t / 2, left: 0, pointerEvents: 'none', zIndex: 4 }}
      viewBox={`0 0 40 ${t}`} preserveAspectRatio="none">
      <rect x="2" y={t / 2 - 1.6} width="36" height="3.2" fill="#c9a44a" rx="1.2" />
      <rect x="0" y={t / 2 - 1.8} width="3" height="3.6" fill="#8a6a26" rx="0.8" />
      <rect x="37" y={t / 2 - 1.8} width="3" height="3.6" fill="#8a6a26" rx="0.8" />
    </svg>
  );
}

function EdgeArchLeft({ cellSize }: { cellSize: number }) {
  const t = Math.max(4, cellSize * 0.12);
  return (
    <svg className="edge-arch edge-arch-left" width={t} height={cellSize}
      style={{ position: 'absolute', top: 0, left: -t / 2, pointerEvents: 'none', zIndex: 4 }}
      viewBox={`0 0 ${t} 40`} preserveAspectRatio="none">
      <rect x={t / 2 - 1.6} y="2" width="3.2" height="36" fill="#c9a44a" rx="1.2" />
      <rect x={t / 2 - 1.8} y="0" width="3.6" height="3" fill="#8a6a26" rx="0.8" />
      <rect x={t / 2 - 1.8} y="37" width="3.6" height="3" fill="#8a6a26" rx="0.8" />
    </svg>
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
