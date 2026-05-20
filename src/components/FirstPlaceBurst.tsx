import type { MultiplayerPlayer } from "../multiplayer/types";

type FirstPlaceBurstProps = {
  player: MultiplayerPlayer | undefined;
  visible: boolean;
};

export function FirstPlaceBurst({ player, visible }: FirstPlaceBurstProps) {
  if (!player || !visible) return null;

  return (
    <aside className="first-place-burst" aria-live="polite">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <strong>1st</strong>
      <span>{player.emoji}</span>
      <small>{player.name}</small>
    </aside>
  );
}
