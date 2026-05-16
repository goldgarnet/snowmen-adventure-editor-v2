import { useState, useRef, useEffect } from 'react';
import { Level, SunDirection } from '../types';
import { createDefaultTile, createLevel, cloneLevel, deserializeLevel } from '../utils/level';
import { encodeLevelCode, decodeLevelCode } from '../utils/levelCode';
import Grid from './Grid';
import './Editor.css';

type EditorTool =
  | 'warm'
  | 'cool'
  | 'flake'
  | 'goal'
  | 'rowTunnel'
  | 'columnTunnel'
  | 'edgeArch'
  | 'player'
  | 'snowballLarge'
  | 'snowballSmall'
  | 'wall'
  | 'block'
  | 'tree'
  | 'eraser';

const DRAG_TOOLS: EditorTool[] = ['warm', 'cool', 'flake', 'wall', 'eraser'];
const EDGE_TOOLS: EditorTool[] = ['edgeArch', 'eraser'];

interface EditorProps {
  level: Level;
  setLevel: (level: Level) => void;
}

export default function Editor({ level, setLevel }: EditorProps) {
  const [selectedTool, setSelectedTool] = useState<EditorTool>('warm');
  const [treeHeight, setTreeHeight] = useState<number>(2);
  const [showImportExport, setShowImportExport] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [copyMsg, setCopyMsg] = useState(false);
  const dragLevelRef = useRef<Level | null>(null);

  // Local string state for width/height inputs so users can clear them.
  const [widthInput, setWidthInput] = useState<string>(level.width.toString());
  const [heightInput, setHeightInput] = useState<string>(level.height.toString());
  useEffect(() => { setWidthInput(level.width.toString()); }, [level.width]);
  useEffect(() => { setHeightInput(level.height.toString()); }, [level.height]);

  const handleWidthChange = (raw: string) => {
    setWidthInput(raw);
    if (raw === '') { resizeMap(0, level.height); return; }
    const n = parseInt(raw, 10);
    if (!isNaN(n)) resizeMap(n, level.height);
  };
  const handleHeightChange = (raw: string) => {
    setHeightInput(raw);
    if (raw === '') { resizeMap(level.width, 0); return; }
    const n = parseInt(raw, 10);
    if (!isNaN(n)) resizeMap(level.width, n);
  };

  const handleCellClick = (row: number, col: number) => {
    const newLevel = cloneLevel(level);
    applyTool(newLevel, row, col, selectedTool);
    if (DRAG_TOOLS.includes(selectedTool)) {
      dragLevelRef.current = newLevel;
    }
    setLevel(newLevel);
  };

  const handleCellDrag = (row: number, col: number) => {
    if (!DRAG_TOOLS.includes(selectedTool)) return;
    const base = dragLevelRef.current ?? level;
    const newLevel = cloneLevel(base);
    applyTool(newLevel, row, col, selectedTool);
    dragLevelRef.current = newLevel;
    setLevel(newLevel);
  };

  const handleEdgeClick = (row: number, col: number, side: 'top' | 'left') => {
    if (!EDGE_TOOLS.includes(selectedTool)) return;
    const newLevel = cloneLevel(level);
    const tile = newLevel.tiles[row][col];
    if (selectedTool === 'edgeArch') {
      // Toggle
      if (side === 'top') tile.edgeArchTop = !tile.edgeArchTop;
      else tile.edgeArchLeft = !tile.edgeArchLeft;
    } else if (selectedTool === 'eraser') {
      if (side === 'top') tile.edgeArchTop = false;
      else tile.edgeArchLeft = false;
    }
    setLevel(newLevel);
  };

  const applyTool = (lv: Level, row: number, col: number, tool: EditorTool) => {
    const tile = lv.tiles[row][col];

    switch (tool) {
      case 'warm':
        tile.isWarm = true;
        tile.isFlake = false;
        break;
      case 'cool':
        tile.isWarm = false;
        break;
      case 'flake':
        tile.isFlake = true;
        tile.isWarm = false;
        break;
      case 'goal':
        for (let r = 0; r < lv.height; r++)
          for (let c = 0; c < lv.width; c++)
            lv.tiles[r][c].isGoal = false;
        tile.isGoal = true;
        break;
      case 'rowTunnel':
        tile.isRowArch = true;
        tile.isColumnArch = false;
        tile.isShade = true;
        tile.isWarm = false;
        break;
      case 'columnTunnel':
        tile.isColumnArch = true;
        tile.isRowArch = false;
        tile.isShade = true;
        tile.isWarm = false;
        break;
      case 'edgeArch':
        // Edge arches are placed via handleEdgeClick, not cell click.
        // A cell-center click toggles nothing (no-op).
        break;
      case 'player':
        for (let r = 0; r < lv.height; r++)
          for (let c = 0; c < lv.width; c++)
            if (lv.objects[r][c]?.type === 'player') lv.objects[r][c] = null;
        lv.objects[row][col] = { type: 'player', size: 2, isMelting: false, createdAt: 0 };
        break;
      case 'snowballLarge':
        lv.objects[row][col] = { type: 'snowball', size: 2, isMelting: false, createdAt: 0 };
        break;
      case 'snowballSmall':
        lv.objects[row][col] = { type: 'snowball', size: 1, isMelting: false, createdAt: 0 };
        break;
      case 'wall':
        lv.objects[row][col] = { type: 'wall', size: 100, isMelting: false, createdAt: 0 };
        break;
      case 'block':
        lv.objects[row][col] = { type: 'block', size: 1, isMelting: false, createdAt: 0 };
        break;
      case 'tree':
        lv.objects[row][col] = { type: 'tree', size: 100, isMelting: false, treeHeight, createdAt: 0 };
        break;
      case 'eraser':
        lv.objects[row][col] = null;
        tile.isFlake = false;
        tile.isGoal = false;
        tile.isRowArch = false;
        tile.isColumnArch = false;
        tile.isShade = false;
        // Note: edge arches are erased via handleEdgeClick when clicking edges.
        break;
    }
  };

  const resizeMap = (newWidth: number, newHeight: number) => {
    const w = Math.max(0, Math.min(30, newWidth));
    const h = Math.max(0, Math.min(30, newHeight));
    const newLevel: Level = {
      width: w,
      height: h,
      sunDirection: level.sunDirection,
      hasShadow: level.hasShadow,
      tiles: [],
      objects: [],
    };
    for (let r = 0; r < h; r++) {
      newLevel.tiles.push([]);
      newLevel.objects.push([]);
      for (let c = 0; c < w; c++) {
        if (r < level.height && c < level.width) {
          newLevel.tiles[r].push({ ...level.tiles[r][c] });
          newLevel.objects[r].push(level.objects[r][c] ? { ...level.objects[r][c]! } : null);
        } else {
          newLevel.tiles[r].push(createDefaultTile());
          newLevel.objects[r].push(null);
        }
      }
    }
    setLevel(newLevel);
  };

  const resetMap = () => {
    setLevel(createLevel(level.width, level.height));
  };

  const fillAll = (warm: boolean) => {
    const newLevel = cloneLevel(level);
    for (let r = 0; r < newLevel.height; r++)
      for (let c = 0; c < newLevel.width; c++) {
        newLevel.tiles[r][c].isWarm = warm;
        if (warm) newLevel.tiles[r][c].isFlake = false;
      }
    setLevel(newLevel);
  };

  const toggleShadow = () => {
    const newLevel = cloneLevel(level);
    newLevel.hasShadow = !newLevel.hasShadow;
    setLevel(newLevel);
  };

  const handleExport = () => {
    const code = encodeLevelCode(level);
    setJsonText(code);
    navigator.clipboard.writeText(code).then(() => {
      setCopyMsg(true);
      setTimeout(() => setCopyMsg(false), 2000);
    });
    setShowImportExport(true);
  };

  const handleImport = () => {
    const text = jsonText.trim();
    const imported = text.startsWith('{')
      ? deserializeLevel(text)
      : decodeLevelCode(text);
    if (imported) {
      setLevel(imported);
      setShowImportExport(false);
    } else {
      alert('잘못된 레벨 코드입니다');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText).then(() => {
      setCopyMsg(true);
      setTimeout(() => setCopyMsg(false), 2000);
    });
  };

  const tileTools: { id: EditorTool; label: string; emoji: string }[] = [
    { id: 'warm', label: '따뜻함', emoji: '🟧' },
    { id: 'cool', label: '차가움', emoji: '🟦' },
    { id: 'flake', label: '눈꽃', emoji: '❄️' },
    { id: 'goal', label: '골', emoji: '⭐' },
    { id: 'columnTunnel', label: '가로 터널', emoji: '🚇' },
    { id: 'rowTunnel', label: '세로 터널', emoji: '🚇' },
  ];

  const objectTools: { id: EditorTool; label: string; emoji: string }[] = [
    { id: 'player', label: '플레이어', emoji: '⛄' },
    { id: 'wall', label: '벽', emoji: '🧱' },
    { id: 'snowballLarge', label: '큰 눈덩이', emoji: '⚪' },
    { id: 'snowballSmall', label: '작은 눈덩이', emoji: '🔵' },
    { id: 'block', label: '블록', emoji: '📦' },
    { id: 'tree', label: '나무', emoji: '🌲' },
  ];

  return (
    <div className="editor">
      <div className="editor-sidebar">
        <section className="editor-section">
          <h3>맵</h3>
          <div className="size-controls">
            <label>
              가로:
              <input type="number" min={0} max={30} value={widthInput}
                onChange={(e) => handleWidthChange(e.target.value)} />
            </label>
            <label>
              세로:
              <input type="number" min={0} max={30} value={heightInput}
                onChange={(e) => handleHeightChange(e.target.value)} />
            </label>
          </div>
          <button className={`shadow-toggle ${level.hasShadow ? 'on' : 'off'}`}
            onClick={toggleShadow}>
            그림자: {level.hasShadow ? 'ON' : 'OFF'}
          </button>
          <div className="sun-section">
            <span className="sun-label">해 방향</span>
            <div className="sun-controls">
              {(['left', 'right', 'up', 'down'] as SunDirection[]).map((dir) => (
                <button key={dir}
                  disabled={!level.hasShadow}
                  className={level.sunDirection === dir ? 'active' : ''}
                  onClick={() => setLevel({ ...cloneLevel(level), sunDirection: dir })}>
                  {dir === 'left' ? '←' : dir === 'right' ? '→' : dir === 'up' ? '↑' : '↓'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="editor-section">
          <h3>타일</h3>
          <div className="tool-group-2col">
            {tileTools.map((tool) => (
              <button key={tool.id}
                className={`tool-btn ${selectedTool === tool.id ? 'active' : ''}`}
                onClick={() => setSelectedTool(tool.id)}>
                <span className="tool-emoji">{tool.emoji}</span>{tool.label}
              </button>
            ))}
          </div>
          <button className={`tool-btn arch-btn-full ${selectedTool === 'edgeArch' ? 'active' : ''}`}
            onClick={() => setSelectedTool('edgeArch')}
            style={{ marginTop: 6 }}>
            <span className="tool-emoji">🏛️</span>아치 (모서리 클릭)
          </button>
        </section>

        <section className="editor-section">
          <h3>오브젝트</h3>
          <div className="tool-group-2col">
            {objectTools.map((tool) => (
              <button key={tool.id}
                className={`tool-btn ${selectedTool === tool.id ? 'active' : ''}`}
                onClick={() => setSelectedTool(tool.id)}>
                <span className="tool-emoji">{tool.emoji}</span>{tool.label}
              </button>
            ))}
          </div>
          {selectedTool === 'tree' && (
            <div className="tree-height-input">
              <label>
                높이:
                <input type="number" min={0.5} step={0.5} value={treeHeight}
                  onChange={(e) => setTreeHeight(Number(e.target.value))} />
              </label>
            </div>
          )}
        </section>

        <section className="editor-section">
          <button className={`tool-btn eraser-btn-full ${selectedTool === 'eraser' ? 'active' : ''}`}
            onClick={() => setSelectedTool('eraser')}>
            <span className="tool-emoji">🧹</span>지우개
          </button>
        </section>

        <section className="editor-section">
          <h3>동작</h3>
          <div className="action-col">
            <button onClick={() => fillAll(true)}>🟧 따뜻한 칸으로 채우기</button>
            <button onClick={() => fillAll(false)}>🟦 차가운 칸으로 채우기</button>
            <button onClick={resetMap} className="danger-btn">🗑️ 초기화</button>
          </div>
          <div className="action-row" style={{ marginTop: 6 }}>
            <button onClick={handleExport}>내보내기</button>
            <button onClick={() => { setJsonText(''); setShowImportExport(true); }}>불러오기</button>
          </div>
        </section>
      </div>

      <div className="editor-grid-area">
        <Grid level={level}
          onCellClick={handleCellClick}
          onCellDrag={handleCellDrag}
          onEdgeClick={handleEdgeClick}
          edgeMode={EDGE_TOOLS.includes(selectedTool)} />
      </div>

      {copyMsg && <div className="toast">클립보드에 복사되었습니다!</div>}

      {showImportExport && (
        <div className="modal-overlay" onClick={() => setShowImportExport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>레벨 코드 불러오기 / 내보내기</h3>
            <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)}
              rows={4} placeholder="레벨 코드를 여기에 붙여넣으세요..." />
            <div className="modal-buttons">
              <button onClick={handleImport}>불러오기</button>
              <button onClick={handleCopy}>복사</button>
              <button onClick={() => setShowImportExport(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
