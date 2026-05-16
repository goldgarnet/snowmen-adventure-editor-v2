import { useState } from 'react';
import { Level, GameState } from './types';
import { createLevel, cloneLevel } from './utils/level';
import { recalcShadows } from './engine/shadow';
import Editor from './components/Editor';
import Simulator from './components/Simulator';
import './App.css';

type Mode = 'editor' | 'simulator';

function App() {
  const [mode, setMode] = useState<Mode>('editor');
  const [level, setLevel] = useState<Level>(createLevel(8, 8));
  const [gameState, setGameState] = useState<GameState | null>(null);

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
