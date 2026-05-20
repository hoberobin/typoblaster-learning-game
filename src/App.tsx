import { useEffect, useMemo, useRef, useState } from "react";
import { FirstPlaceBurst } from "./components/FirstPlaceBurst";
import { GameScreen } from "./components/GameScreen";
import { PlayerSetup } from "./components/PlayerSetup";
import { ResetVoteToast } from "./components/ResetVoteToast";
import { SettingsPanel } from "./components/SettingsPanel";
import { TitleScreen } from "./components/TitleScreen";
import { useGameEngine } from "./hooks/useGameEngine";
import { useMultiplayerSession } from "./multiplayer/useMultiplayerSession";

type PanelMode = "help" | "settings";

export default function App() {
  const engine = useGameEngine();
  const multiplayer = useMultiplayerSession(engine.snapshot);
  const [showFullTitle, setShowFullTitle] = useState(true);
  const [pendingStart, setPendingStart] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("help");
  const [panelOpen, setPanelOpen] = useState(false);
  const [firstPlaceId, setFirstPlaceId] = useState("");
  const [showFirstPlace, setShowFirstPlace] = useState(false);
  const [joinNotice, setJoinNotice] = useState<{ name: string; emoji: string } | null>(null);
  const previousLeaderRef = useRef("");
  const previousPlayerIdsRef = useRef<Set<string> | null>(null);
  const processedKeyEventsRef = useRef<Set<string>>(new Set());

  const firstPlacePlayer = useMemo(
    () => multiplayer.activePlayers.find((player) => player.id === firstPlaceId),
    [firstPlaceId, multiplayer.activePlayers],
  );

  const coopPlayers = useMemo(
    () =>
      multiplayer.activePlayers.slice(0, 6).map((player) => ({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        lettersTyped: player.lettersTyped,
        score: player.score,
      })),
    [multiplayer.activePlayers],
  );

  const openPanel = (mode: PanelMode) => {
    if (engine.snapshot.status === "playing") {
      engine.pause();
    }
    setPanelMode(mode);
    setPanelOpen(true);
  };

  const start = () => {
    if (!multiplayer.profile || multiplayer.locked) return;
    setShowFullTitle(false);
    setPendingStart(true);
  };

  useEffect(() => {
    if (!pendingStart || !engine.hasEngine) return;
    engine.start();
    setPendingStart(false);
  }, [engine, pendingStart]);

  useEffect(() => {
    if (!multiplayer.profile || multiplayer.isSyncHost || !multiplayer.remoteSyncState) return;
    const generation = multiplayer.session?.generation ?? multiplayer.profile.generation;
    if (multiplayer.remoteSyncState.generation !== generation) return;
    if (
      multiplayer.remoteSyncState.status === "playing" ||
      multiplayer.remoteSyncState.status === "paused" ||
      multiplayer.remoteSyncState.status === "gameOver"
    ) {
      setShowFullTitle(false);
    }
  }, [
    multiplayer.isSyncHost,
    multiplayer.profile,
    multiplayer.remoteSyncState,
    multiplayer.session?.generation,
  ]);

  useEffect(() => {
    if (!showFullTitle) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") start();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFullTitle, multiplayer.profile, multiplayer.locked]);

  useEffect(() => {
    engine.setCoopPlayers(coopPlayers, multiplayer.profile?.id ?? "");
  }, [coopPlayers, multiplayer.profile?.id]);

  useEffect(() => {
    engine.setSyncHost(multiplayer.isSyncHost);
  }, [engine, multiplayer.isSyncHost]);

  useEffect(() => {
    engine.setInputBroadcasters(multiplayer.publishTextInput, multiplayer.publishBackspace);
  }, [engine, multiplayer.publishBackspace, multiplayer.publishTextInput]);

  useEffect(() => {
    if (!multiplayer.profile || !engine.hasEngine) return;
    if (multiplayer.isSyncHost) {
      const sync = engine.getSyncState(
        multiplayer.session?.generation ?? multiplayer.profile.generation,
        multiplayer.profile.id,
      );
      if (sync) multiplayer.publishSyncState(sync);
      return;
    }

    if (
      multiplayer.remoteSyncState &&
      multiplayer.remoteSyncState.generation ===
        (multiplayer.session?.generation ?? multiplayer.profile.generation)
    ) {
      engine.applySyncState(multiplayer.remoteSyncState);
    }
  }, [
    engine,
    engine.snapshot,
    multiplayer.isSyncHost,
    multiplayer.profile,
    multiplayer.publishSyncState,
    multiplayer.remoteSyncState,
    multiplayer.session?.generation,
  ]);

  useEffect(() => {
    if (!multiplayer.profile || !engine.hasEngine) return;
    const generation = multiplayer.session?.generation ?? multiplayer.profile.generation;
    const seen = processedKeyEventsRef.current;
    const now = Date.now();
    for (const event of multiplayer.remoteKeyEvents) {
      if (event.generation !== generation || event.playerId === multiplayer.profile.id) continue;
      if (now - event.createdAtMs > 15_000) continue;
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      if (event.kind === "backspace") {
        engine.handleRemoteBackspace(event.playerId);
      } else {
        engine.handleRemoteTextInput(event.playerId, event.value);
      }
    }
    if (seen.size > 240) {
      processedKeyEventsRef.current = new Set([...seen].slice(-120));
    }
  }, [
    engine,
    engine.hasEngine,
    multiplayer.profile,
    multiplayer.remoteKeyEvents,
    multiplayer.session?.generation,
  ]);

  useEffect(() => {
    if (multiplayer.profile || showFullTitle) return;
    setShowFullTitle(true);
    engine.showTitle();
  }, [multiplayer.profile, showFullTitle]);

  useEffect(() => {
    const leaderId = multiplayer.leaderId;
    if (!leaderId) return;
    if (!previousLeaderRef.current) {
      previousLeaderRef.current = leaderId;
      return;
    }
    if (previousLeaderRef.current === leaderId) return;
    previousLeaderRef.current = leaderId;
    setFirstPlaceId(leaderId);
    setShowFirstPlace(true);
    const timer = window.setTimeout(() => setShowFirstPlace(false), 3200);
    return () => window.clearTimeout(timer);
  }, [multiplayer.leaderId]);

  useEffect(() => {
    const currentIds = new Set(multiplayer.activePlayers.map((player) => player.id));
    if (!previousPlayerIdsRef.current) {
      previousPlayerIdsRef.current = currentIds;
      return;
    }

    const joined = multiplayer.activePlayers.find(
      (player) => !previousPlayerIdsRef.current?.has(player.id),
    );
    previousPlayerIdsRef.current = currentIds;
    if (!joined) return;

    setJoinNotice({ name: joined.name, emoji: joined.emoji });
    engine.playJoinCroak();
    const timer = window.setTimeout(() => setJoinNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [multiplayer.activePlayers]);

  const sharedOverlays = (
    <>
      {(!multiplayer.profile || multiplayer.locked) && (
        <PlayerSetup locked={multiplayer.locked} onSave={multiplayer.savePlayer} />
      )}
      <ResetVoteToast
        vote={multiplayer.session?.currentVote}
        profile={multiplayer.profile}
        onVote={multiplayer.castVote}
      />
      <FirstPlaceBurst player={firstPlacePlayer} visible={showFirstPlace} />
      {joinNotice && (
        <aside className="join-notice" role="status">
          <strong>{joinNotice.emoji}</strong>
          <span>{joinNotice.name} just hopped in</span>
        </aside>
      )}
      <button
        className="reset-vote-button retro-button secondary"
        disabled={!multiplayer.profile || multiplayer.locked}
        onClick={multiplayer.requestReset}
      >
        Reset Vote
      </button>
    </>
  );

  if (showFullTitle) {
    return (
      <>
        <TitleScreen
          onStart={start}
          onHelp={() => openPanel("help")}
          onSettings={() => openPanel("settings")}
        />
        <SettingsPanel
          open={panelOpen}
          mode={panelMode}
          settings={engine.settings}
          onChange={engine.setSettings}
          onClose={() => setPanelOpen(false)}
        />
        {sharedOverlays}
      </>
    );
  }

  return (
    <>
      <GameScreen
        canvasRef={engine.canvasRef}
        snapshot={engine.snapshot}
        players={multiplayer.activePlayers}
        leaderboard={multiplayer.leaderboard}
        currentLeaderboardId={multiplayer.currentLeaderboardId}
        currentPlayerId={multiplayer.profile?.id}
        leaderId={multiplayer.leaderId}
        onStart={start}
        onRestart={engine.restart}
        onTitle={() => {
          setShowFullTitle(true);
          engine.showTitle();
        }}
        onHelp={() => openPanel("help")}
        onSettings={() => openPanel("settings")}
        onPause={engine.pause}
        onResume={engine.resume}
        onBonusAnswer={(correct) => {
          if (correct) engine.awardBonusPoints(100);
        }}
        onTextInput={engine.handleTextInput}
        onBackspace={engine.handleBackspace}
      />
      <SettingsPanel
        open={panelOpen}
        mode={panelMode}
        settings={engine.settings}
        onChange={engine.setSettings}
        onClose={() => setPanelOpen(false)}
      />
      {sharedOverlays}
    </>
  );
}
