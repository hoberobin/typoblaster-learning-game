import { useEffect, useRef, useState } from "react";
import type { GameSnapshot } from "../game/types";
import type { MultiplayerPlayer, TeamLeaderboardEntry } from "../multiplayer/types";
import { GameOverScreen } from "./GameOverScreen";
import { Hud } from "./Hud";
import { ScoreboardBar } from "./ScoreboardBar";

type GameScreenProps = {
  canvasRef: (canvas: HTMLCanvasElement | null) => void;
  snapshot: GameSnapshot;
  players: MultiplayerPlayer[];
  leaderboard: TeamLeaderboardEntry[];
  currentLeaderboardId: string;
  currentPlayerId?: string;
  leaderId: string;
  onStart: () => void;
  onRestart: () => void;
  onTitle: () => void;
  onHelp: () => void;
  onSettings: () => void;
  onPause: () => void;
  onResume: () => void;
  onBonusAnswer: (correct: boolean) => void;
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
  onBonusAnswer,
  onTextInput,
  onBackspace,
  players,
  leaderboard,
  currentLeaderboardId,
  currentPlayerId,
  leaderId,
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
          {!hasRunStarted && <p className="eyebrow">Pond Typing Arcade</p>}
          <h1>Frog Zap Words</h1>
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
        <ScoreboardBar
          players={players}
          currentPlayerId={currentPlayerId}
          leaderId={leaderId}
          teamLettersPerMinute={snapshot.teamLettersPerMinute}
        />
        <Hud snapshot={snapshot} />

        <div
          className="canvas-wrap"
          onPointerDown={() => {
            if (isPlaying) inputRef.current?.focus();
          }}
        >
          <canvas ref={canvasRef} aria-label="Frog Zap Words typing pond game canvas" />

          {snapshot.currentPlayerCroaked && !isGameOver && (
            <div className="croaked-banner" role="status">
              <strong>YOU CROAKED</strong>
              <span>Watch your comrades finish the swarm.</span>
            </div>
          )}

          {isTitle && (
            <div className="start-overlay">
              <section className="modal-card">
                <p className="eyebrow">Ready?</p>
                <h2>Type the word to catch the fly.</h2>
                <p>The yellow letter shows what your frog needs next.</p>
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
                <p>Press Escape or Resume to hop back in.</p>
                <button className="retro-button primary" onClick={onResume}>
                  Resume
                </button>
              </section>
            </div>
          )}

          {isGameOver && (
            <GameOverScreen
              snapshot={snapshot}
              players={players.slice(0, 6)}
              leaderboard={leaderboard}
              currentLeaderboardId={currentLeaderboardId}
              onRestart={onRestart}
              onTitle={onTitle}
              onBonusAnswer={onBonusAnswer}
            />
          )}
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
          disabled={!isPlaying || snapshot.currentPlayerCroaked}
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
              const added = next.slice(typedValue.length);
              onTextInput(added);
            }
            setTypedValue("");
          }}
        />
      </section>
    </main>
  );
}
