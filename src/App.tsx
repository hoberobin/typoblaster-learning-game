import { useEffect, useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { TitleScreen } from "./components/TitleScreen";
import { useGameEngine } from "./hooks/useGameEngine";

type PanelMode = "help" | "settings";

export default function App() {
  const engine = useGameEngine();
  const [showFullTitle, setShowFullTitle] = useState(true);
  const [pendingStart, setPendingStart] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("help");
  const [panelOpen, setPanelOpen] = useState(false);

  const openPanel = (mode: PanelMode) => {
    if (engine.snapshot.status === "playing") {
      engine.pause();
    }
    setPanelMode(mode);
    setPanelOpen(true);
  };

  const start = () => {
    setShowFullTitle(false);
    setPendingStart(true);
  };

  useEffect(() => {
    if (!pendingStart || !engine.hasEngine) return;
    engine.start();
    setPendingStart(false);
  }, [engine, pendingStart]);

  useEffect(() => {
    if (!showFullTitle) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") start();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFullTitle]);

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
      </>
    );
  }

  return (
    <>
      <GameScreen
        canvasRef={engine.canvasRef}
        snapshot={engine.snapshot}
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
    </>
  );
}
