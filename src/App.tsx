import { useState } from 'react';
import { Level, GameState } from './types';
import { createLevel, cloneLevel } from './utils/level';
import { recalcShadows } from './engine/shadow';
import Editor from './components/Editor';
import Simulator from './components/Simulator';
import './App.css';

type Mode = 'editor' | 'simulator';

function levelToGameJSON(level: Level): object {
  const objects: object[] = [];
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const obj = level.objects[row]?.[col];
      if (!obj) continue;
      const entry: Record<string, unknown> = { type: obj.type, x: col, y: row, size: obj.size };
      if (obj.type === 'tree' && obj.treeHeight != null) entry.height = obj.treeHeight;
      if (obj.type === 'laser') entry.direction = obj.laserDirection ?? 'right';
      objects.push(entry);
    }
  }
  const tiles = level.tiles.map(row =>
    row.map(tile => {
      const t: Record<string, unknown> = { isWarm: tile.isWarm };
      if (tile.isFlake) t.isFlake = true;
      if (tile.isGoal) t.isGoal = true;
      if (tile.edgeArchTop) t.edgeArchTop = tile.edgeArchTop;
      if (tile.edgeArchLeft) t.edgeArchLeft = tile.edgeArchLeft;
      return t;
    })
  );
  return {
    schemaVersion: 1,
    id: 'LXXX',
    name: '새 레벨',
    grid: { width: level.width, height: level.height },
    sunDirection: level.sunDirection,
    tiles,
    objects,
  };
}

function App() {
  const [mode, setMode] = useState<Mode>('editor');
  const [level, setLevel] = useState<Level>(createLevel(8, 8));
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [copied, setCopied] = useState(false);

  const copyJSON = () => {
    const json = JSON.stringify(levelToGameJSON(level), null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const startSimulation = () => {
    const simLevel = cloneLevel(level);
    if (simLevel.hasShadow) recalcShadows(simLevel);
    setGameState({
      level: simLevel,
      status: 'playing',
      turnCount: 0,
      history: [],
    });
    setMode('simulator');
  };

  const backToEditor = () => {
    setMode('editor');
    setGameState(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Snowmen Adventure 레벨 에디터 V2</h1>
        <div className="mode-tabs">
          <button
            className={mode === 'editor' ? 'active' : ''}
            onClick={backToEditor}
          >
            에디터
          </button>
          <button
            className={mode === 'simulator' ? 'active' : ''}
            onClick={startSimulation}
          >
            시뮬레이터
          </button>
          <button
            className={`copy-json-btn${copied ? ' copied' : ''}`}
            onClick={copyJSON}
          >
            {copied ? '✓ 복사됨!' : 'JSON 복사'}
          </button>
        </div>
      </header>
      <main className="app-main">
        {mode === 'editor' ? (
          <Editor level={level} setLevel={setLevel} />
        ) : gameState ? (
          <Simulator gameState={gameState} setGameState={setGameState} />
        ) : null}
      </main>
    </div>
  );
}

export default App;
