import type { GameSettings, GradeBand, Pace } from "../game/types";

type SettingsPanelProps = {
  open: boolean;
  mode: "help" | "settings";
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onClose: () => void;
};

export function SettingsPanel({ open, mode, settings, onChange, onClose }: SettingsPanelProps) {
  if (!open) return null;

  const update = <Key extends keyof GameSettings>(key: Key, value: GameSettings[Key]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "help" ? "How to Play" : "Settings"}
    >
      <div className="dialog-stack">
        {mode === "help" ? (
          <section className="modal-card">
            <p className="eyebrow">How to Play</p>
            <h1>Feed the frog.</h1>
            <ol className="how-list">
              <li>A fly floats in with a word.</li>
              <li>Type the word from left to right.</li>
              <li>The yellow letter is the next sound or letter to press.</li>
              <li>Finish the word to flick the frog tongue and build a streak.</li>
              <li>Catch flies before they cross the lily pad line.</li>
            </ol>
          </section>
        ) : (
          <section className="modal-card">
            <p className="eyebrow">Settings</p>
            <h2>Player Options</h2>

            <label className="setting-row">
              <span>Grade Band</span>
              <select
                value={settings.gradeBand}
                onChange={(event) => update("gradeBand", event.target.value as GradeBand)}
              >
                <option value="k2">K-2</option>
                <option value="g35">3-5</option>
                <option value="g68">6-8</option>
              </select>
            </label>

            <label className="setting-row">
              <span>Pace</span>
              <select
                value={settings.pace}
                onChange={(event) => update("pace", event.target.value as Pace)}
              >
                <option value="relaxed">Relaxed</option>
                <option value="normal">Normal</option>
                <option value="challenge">Challenge</option>
              </select>
            </label>

            <label className="setting-row">
              <span>Reduced Motion</span>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(event) => update("reducedMotion", event.target.checked)}
              />
            </label>

            <label className="setting-row">
              <span>Screen Shake</span>
              <input
                type="checkbox"
                checked={settings.screenShake}
                onChange={(event) => update("screenShake", event.target.checked)}
              />
            </label>

            <label className="setting-row">
              <span>Sound Effects</span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(event) => update("soundEnabled", event.target.checked)}
              />
            </label>
          </section>
        )}

        <button className="retro-button primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
