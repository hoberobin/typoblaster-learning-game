import { useMemo, useState } from "react";

const EMOJIS = [
  "🐸",
  "🔥",
  "⚡",
  "🌟",
  "🍄",
  "🌈",
  "🍀",
  "🎯",
  "🚀",
  "🛸",
  "🤖",
  "👾",
  "🎮",
  "🕹️",
  "🏆",
  "💎",
  "🍎",
  "🍉",
  "🍋",
  "🍇",
  "🍓",
  "🥝",
  "🥨",
  "🍕",
  "🐝",
  "🦋",
  "🐢",
  "🦎",
  "🐙",
  "🦕",
  "🦖",
  "🐲",
  "🌵",
  "🌻",
  "🌙",
  "☀️",
  "⭐",
  "☁️",
  "❄️",
  "🌊",
  "🎧",
  "🎹",
  "🥁",
  "🎺",
  "🎲",
  "♟️",
  "🧩",
  "📚",
  "✏️",
  "🔤",
  "💡",
  "🔭",
  "🧪",
  "🧠",
  "🗺️",
  "🧭",
  "🥇",
  "🥈",
  "🥉",
  "🎈",
  "🎉",
  "🎁",
  "🪄",
  "🛡️",
];

type PlayerSetupProps = {
  locked: boolean;
  onSave: (name: string, emoji: string) => Promise<void>;
};

export function PlayerSetup({ locked, onSave }: PlayerSetupProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🐸");
  const [saving, setSaving] = useState(false);
  const emojis = useMemo(() => EMOJIS.slice(0, 64), []);

  return (
    <div className="dialog-backdrop player-setup-backdrop" role="dialog" aria-modal="true">
      <section className="modal-card player-setup-card">
        <p className="eyebrow">{locked ? "Session Locked" : "Join Session"}</p>
        <h2>{locked ? "This pond is read-only." : "Pick your player."}</h2>
        {locked ? (
          <p>The permanent session is more than two weeks old, so Firestore writes are disabled.</p>
        ) : (
          <>
            <label className="name-entry">
              <span>Name</span>
              <input
                value={name}
                maxLength={18}
                placeholder="Your name"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="emoji-grid" aria-label="Avatar emoji">
              {emojis.map((item) => (
                <button
                  className={`emoji-choice ${emoji === item ? "selected" : ""}`}
                  key={item}
                  type="button"
                  onClick={() => setEmoji(item)}
                  aria-label={`Use ${item} avatar`}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              className="retro-button primary"
              disabled={saving}
              onClick={() => {
                setSaving(true);
                onSave(name, emoji).finally(() => setSaving(false));
              }}
            >
              Enter Pond
            </button>
          </>
        )}
      </section>
    </div>
  );
}
