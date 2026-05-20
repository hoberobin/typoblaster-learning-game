import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "../game/GameEngine";
import { loadSettings, saveSettings } from "../game/storage";
import type { CoopPlayer, GameSettings, GameSnapshot, GameSyncState } from "../game/types";

const initialSnapshot: GameSnapshot = {
  status: "title",
  score: 0,
  highScore: 0,
  lives: 3,
  streak: 0,
  level: 1,
  teamLettersPerMinute: 0,
  roundNumber: 1,
  roundPhase: "intro",
  roundTimeRemaining: 0,
  accuracy: 100,
  elapsedSeconds: 0,
  longestStreak: 0,
  lettersTyped: 0,
  wordsCompleted: 0,
  survivalTime: 0,
  levelReached: 1,
  currentWord: "",
  typedIndex: 0,
  assignedPlayerName: "",
  assignedPlayerEmoji: "",
  teamFlyCount: 0,
  gradeBand: "k2",
  hardestWord: "",
  roundComplete: false,
  croakedPlayerIds: [],
  currentPlayerCroaked: false,
  currentPlayerMisses: 0,
  currentPlayerMissesAllowed: 3,
};

export function useGameEngine() {
  const engineRef = useRef<GameEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [settings, setSettingsState] = useState<GameSettings>(() => loadSettings());
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshot);
  const [hasEngine, setHasEngine] = useState(false);

  const attachCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) {
        canvasRef.current = null;
        engineRef.current?.dispose();
        engineRef.current = null;
        setHasEngine(false);
        return;
      }

      canvasRef.current = canvas;
      if (engineRef.current) return;

      const engine = new GameEngine(canvas, setSnapshot, settings);
      engineRef.current = engine;
      engine.startLoop();
      setHasEngine(true);
    },
    [settings],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      engineRef.current?.handleKeyDown(event);
    };

    const handleResize = () => {
      engineRef.current?.resize();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      engineRef.current?.dispose();
      engineRef.current = null;
      setHasEngine(false);
    };
  }, []);

  const setSettings = useCallback((next: GameSettings) => {
    setSettingsState(next);
    saveSettings(next);
    engineRef.current?.setSettings(next);
  }, []);

  return {
    canvasRef: attachCanvas,
    snapshot,
    settings,
    setSettings,
    hasEngine,
    start: () => engineRef.current?.start(),
    restart: () => engineRef.current?.restart(),
    pause: () => engineRef.current?.pause(),
    resume: () => engineRef.current?.resume(),
    awardBonusPoints: (points: number) => engineRef.current?.awardBonusPoints(points),
    playJoinCroak: () => engineRef.current?.playJoinCroak(),
    setSyncHost: (isHost: boolean) => engineRef.current?.setSyncHost(isHost),
    getSyncState: (generation: number, hostId: string) =>
      engineRef.current?.getSyncState(generation, hostId),
    applySyncState: (sync: GameSyncState) => engineRef.current?.applySyncState(sync),
    setInputBroadcasters: (textInput: (value: string) => void, backspace: () => void) =>
      engineRef.current?.setInputBroadcasters(textInput, backspace),
    handleRemoteTextInput: (playerId: string, value: string) =>
      engineRef.current?.handleRemoteTextInput(playerId, value),
    handleRemoteBackspace: (playerId: string) => engineRef.current?.handleRemoteBackspace(playerId),
    setCoopPlayers: (players: CoopPlayer[], currentPlayerId: string) =>
      engineRef.current?.setCoopPlayers(players, currentPlayerId),
    showTitle: () => engineRef.current?.showTitle(),
    handleTextInput: (value: string) => engineRef.current?.handleTextInput(value),
    handleBackspace: () => engineRef.current?.handleBackspace(),
  };
}
