type TitleScreenProps = {
  onStart: () => void;
  onHelp: () => void;
  onSettings: () => void;
};

export function TitleScreen({ onStart, onHelp, onSettings }: TitleScreenProps) {
  return (
    <main className="screen-centered">
      <section className="title-card">
        <p className="eyebrow">Pond Typing Arcade</p>
        <h1>Frog Zap Words</h1>
        <p className="subtitle">Type the word. Flick the tongue. Catch the fly.</p>
        <p>Watch the yellow letter, then type each word from left to right.</p>

        <div className="menu-stack">
          <button className="retro-button primary" onClick={onStart}>
            Start Game
          </button>
          <button className="retro-button" onClick={onHelp}>
            How to Play
          </button>
          <button className="retro-button secondary" onClick={onSettings}>
            Settings
          </button>
        </div>

        <div className="instruction-strip" aria-label="Core loop">
          <span>Spot fly</span>
          <span>Type word</span>
          <span>Zap snack</span>
        </div>
      </section>
    </main>
  );
}
