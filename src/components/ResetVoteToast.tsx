import type { PlayerProfile, ResetVote, VoteChoice } from "../multiplayer/types";

type ResetVoteToastProps = {
  vote: ResetVote | null | undefined;
  profile: PlayerProfile | null;
  onVote: (choice: VoteChoice) => void;
};

export function ResetVoteToast({ vote, profile, onVote }: ResetVoteToastProps) {
  if (!vote || vote.status !== "open" || !profile) return null;

  const currentVote = vote.votes[profile.id];
  const secondsLeft = Math.max(0, Math.ceil((vote.deadlineMs - Date.now()) / 1000));

  return (
    <aside className="reset-toast" role="status">
      <div>
        <strong>{vote.requesterName} wants to reset.</strong>
        <span>{secondsLeft}s left. Majority no blocks it.</span>
      </div>
      <div className="toast-actions">
        <button
          className={`retro-button secondary ${currentVote === "no" ? "selected" : ""}`}
          onClick={() => onVote("no")}
        >
          No
        </button>
        <button
          className={`retro-button primary ${currentVote === "yes" ? "selected" : ""}`}
          onClick={() => onVote("yes")}
        >
          Yes
        </button>
      </div>
    </aside>
  );
}
