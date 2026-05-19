import { useEffect, useRef, useState } from "react";
import type { GameSnapshot } from "../game/types";
import { GameOverScreen } from "./GameOverScreen";
import { Hud } from "./Hud";

type GameScreenProps = {
  canvasRef: (canvas: HTMLCanvasElement | null) => void;
  snapshot: GameSnapshot;
  onStart: () => void;
  onRestart: () => void;
  onTitle: () => void;
  onHelp: () => void;
  onSettings: () => void;
  onPause: () => void;
  onResume: () => void;
  onTextInput: (value: string) => void;
  onBackspace: () => void;
};

export function GameScreen({
  canvasRef,
  snapshot,
  onStart,
  onRestart,
  onTitle,
  onHelp,
  onSettings,
  onPause,
  onResume,
  onTextInput,
  onBackspace,
}: GameScreenProps) {
  const [typedValue, setTypedValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isTitle = snapshot.status === "title";
  const isPaused = snapshot.status === "paused";
  const isGameOver = snapshot.status === "gameOver";
  const isPlaying = snapshot.status === "playing";
  const hasRunStarted = isPlaying || isPaused || isGameOver;

  useEffect(() => {
    if (isPlaying) inputRef.current?.focus();
  }, [isPlaying, snapshot.currentWord]);

  return (
    <main className={`game-shell ${hasRunStarted ? "active-run" : ""}`}>
      <section className={`game-header ${hasRunStarted ? "compact" : ""}`}>
        <div>
          {!hasRunStarted && <p className="eyebrow">Word Creature Arcade</p>}
          <h1>TypoBlaster</h1>
        </div>
        <div className="header-actions">
          {!hasRunStarted && (
            <button className="retro-button" onClick={onStart}>
              Start
            </button>
          )}
          <button className="retro-button secondary" onClick={isPaused ? onResume : onPause}>
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button className="retro-button secondary" onClick={onHelp}>
            How to Play
          </button>
          <button className="retro-button secondary" onClick={onSettings}>
            Settings
          </button>
        </div>
      </section>

      <section className="game-frame">
        <Hud snapshot={snapshot} />

        <div
          className="canvas-wrap"
          onPointerDown={() => {
            if (isPlaying) inputRef.current?.focus();
          }}
        >
          <canvas ref={canvasRef} aria-label="TypoBlaster word creature game canvas" />

          {isTitle && (
            <div className="start-overlay">
              <section className="modal-card">
                <p className="eyebrow">Ready?</p>
                <h2>Type the word to zap the creature.</h2>
                <p>Finish words before they reach your buddy.</p>
                <button className="retro-button primary" onClick={onStart}>
                  Press Enter to Start
                </button>
              </section>
            </div>
          )}

          {isPaused && (
            <div className="start-overlay">
              <section className="modal-card pause-card">
                <p className="eyebrow">Paused</p>
                <h2>Paused</h2>
                <p>Press Escape or the Resume button to keep going.</p>
                <button className="retro-button primary" onClick={onResume}>
                  Resume
                </button>
              </section>
            </div>
          )}

          {isGameOver && <GameOverScreen snapshot={snapshot} onRestart={onRestart} onTitle={onTitle} />}
        </div>

        <input
          ref={inputRef}
          className="screen-reader-typing-input"
          type="text"
          aria-label="Typing input"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          inputMode="text"
          spellCheck={false}
          value={typedValue}
          disabled={!isPlaying}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onPause();
              return;
            }
            if (event.key === "Backspace" && typedValue.length === 0) {
              onBackspace();
            }
          }}
          onChange={(event) => {
            const next = event.target.value;
            if (next.length < typedValue.length) {
              onBackspace();
            } else {
              onTextInput(next.slice(typedValue.length));
            }
            setTypedValue("");
          }}
        />
      </section>
    </main>
  );
}
