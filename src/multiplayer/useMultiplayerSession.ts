import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { Creature, GameSnapshot, GameSyncState } from "../game/types";
import { db } from "./firebase";
import type {
  MultiplayerPlayer,
  PlayerProfile,
  RemoteKeyEvent,
  ResetVote,
  SessionMeta,
  TeamLeaderboardEntry,
  VoteChoice,
} from "./types";

const SESSION_ID = "permanent";
const SESSION_DAYS = 14;
const ACTIVE_WINDOW_MS = 45_000;
const HEARTBEAT_MS = 20_000;
const SCORE_WRITE_MS = 1_800;
const SYNC_WRITE_MS = 140;
const VOTE_WINDOW_MS = 12_000;
const PROFILE_KEY = "typoblaster.multiplayerProfile";

const sessionRef = doc(db, "sessions", SESSION_ID);
const playersRef = collection(db, "sessions", SESSION_ID, "players");
const leaderboardRef = collection(db, "sessions", SESSION_ID, "leaderboard");
const syncStateRef = doc(db, "sessions", SESSION_ID, "sync", "state");
const keyEventsRef = collection(db, "sessions", SESSION_ID, "keyEvents");

export function useMultiplayerSession(snapshot: GameSnapshot) {
  const [session, setSession] = useState<SessionMeta | null>(() => createLocalSession());
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [leaderboard, setLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [remoteSyncState, setRemoteSyncState] = useState<GameSyncState | null>(null);
  const [remoteKeyEvents, setRemoteKeyEvents] = useState<RemoteKeyEvent[]>([]);
  const [currentLeaderboardId, setCurrentLeaderboardId] = useState("");
  const [profile, setProfile] = useState<PlayerProfile | null>(() => loadProfile());
  const writeTimerRef = useRef<number | null>(null);
  const lastWriteAtRef = useRef(0);
  const lastScoreSignatureRef = useRef("");
  const submittedLeaderboardRef = useRef("");
  const lastSyncWriteAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      const snap = await getDoc(sessionRef);
      if (cancelled || snap.exists()) return;
      const now = Date.now();
      await setDoc(sessionRef, {
        id: SESSION_ID,
        generation: 1,
        createdAtMs: now,
        expiresAtMs: now + SESSION_DAYS * 24 * 60 * 60 * 1000,
        locked: false,
        currentVote: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    ensureSession().catch((error) => {
      console.error(error);
      setSession((current) => current ?? createLocalSession());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const expiresAtMs = Number(data.expiresAtMs ?? 0);
        setSession({
          id: String(data.id ?? SESSION_ID),
          generation: Number(data.generation ?? 1),
          createdAtMs: Number(data.createdAtMs ?? Date.now()),
          expiresAtMs,
          locked: Boolean(data.locked) || (expiresAtMs > 0 && Date.now() >= expiresAtMs),
          currentVote: normalizeVote(data.currentVote),
        });
      },
      (error) => {
        console.error(error);
        setSession((current) => current ?? createLocalSession());
      },
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      playersRef,
      (snap) => {
        setPlayers(
          snap.docs.map((playerSnap) => {
            const data = playerSnap.data();
            return {
              id: playerSnap.id,
              name: String(data.name ?? "Player"),
              emoji: String(data.emoji ?? "🐸"),
              generation: Number(data.generation ?? 1),
              score: Number(data.score ?? 0),
              streak: Number(data.streak ?? 0),
              lettersTyped: Number(data.lettersTyped ?? 0),
              accuracy: Number(data.accuracy ?? 100),
              wordsCompleted: Number(data.wordsCompleted ?? 0),
              lastSeenMs: Number(data.lastSeenMs ?? 0),
              online: data.online !== false,
            };
          }),
        );
      },
      (error) => console.error(error),
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      leaderboardRef,
      (snap) => {
        const entries = snap.docs
          .map((entrySnap) => normalizeLeaderboardEntry(entrySnap.id, entrySnap.data()))
          .filter((entry): entry is TeamLeaderboardEntry => Boolean(entry))
          .sort(
            (left, right) =>
              right.score - left.score ||
              right.roundNumber - left.roundNumber ||
              right.createdAtMs - left.createdAtMs,
          )
          .slice(0, 60);
        setLeaderboard(entries);
      },
      (error) => console.error(error),
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      syncStateRef,
      (snap) => {
        if (!snap.exists()) {
          setRemoteSyncState(null);
          return;
        }
        setRemoteSyncState(normalizeSyncState(snap.data()));
      },
      (error) => console.error(error),
    );
  }, []);

  useEffect(() => {
    const recentKeysQuery = query(keyEventsRef, orderBy("createdAtMs", "desc"), limit(80));
    return onSnapshot(
      recentKeysQuery,
      (snap) => {
        const events = snap.docs
          .map((eventSnap) => normalizeKeyEvent(eventSnap.id, eventSnap.data()))
          .filter((event): event is RemoteKeyEvent => Boolean(event))
          .sort((left, right) => left.createdAtMs - right.createdAtMs);
        setRemoteKeyEvents(events);
      },
      (error) => console.error(error),
    );
  }, []);

  useEffect(() => {
    if (!session || !profile) return;
    if (profile.generation === session.generation) return;
    const nextProfile = { ...profile, generation: session.generation };
    setProfile(nextProfile);
    saveProfile(nextProfile);
  }, [profile, session]);

  const locked = Boolean(session?.locked);

  const activePlayers = useMemo(() => {
    const now = Date.now();
    const generation = session?.generation ?? profile?.generation ?? 1;
    const currentPlayer: MultiplayerPlayer | null = profile
      ? {
          ...profile,
          score: snapshot.score,
          streak: snapshot.streak,
          lettersTyped: snapshot.lettersTyped,
          accuracy: snapshot.accuracy,
          wordsCompleted: snapshot.wordsCompleted,
          lastSeenMs: now,
          online: true,
        }
      : null;
    const merged = new Map<string, MultiplayerPlayer>();
    for (const player of players) merged.set(player.id, player);
    if (currentPlayer) merged.set(currentPlayer.id, currentPlayer);

    return [...merged.values()]
      .filter(
        (player) =>
          player.generation === generation &&
          player.online &&
          now - player.lastSeenMs < ACTIVE_WINDOW_MS,
      )
      .sort((left, right) => right.score - left.score || right.streak - left.streak);
  }, [
    players,
    profile,
    session?.generation,
    snapshot.accuracy,
    snapshot.lettersTyped,
    snapshot.score,
    snapshot.streak,
    snapshot.wordsCompleted,
  ]);

  const leaderId = activePlayers[0]?.id ?? "";
  const remoteHostOnline = activePlayers.some((player) => player.id === remoteSyncState?.hostId);
  const remoteGameIsLive =
    Boolean(remoteSyncState?.hostId) &&
    remoteHostOnline &&
    remoteSyncState?.status === "playing" &&
    Date.now() - remoteSyncState.updatedAtMs < 5_000;
  const syncHostId =
    remoteGameIsLive
      ? (remoteSyncState?.hostId ?? "")
      : snapshot.status === "playing" && profile
        ? profile.id
        : activePlayers.map((player) => player.id).sort()[0] ?? profile?.id ?? "";
  const isSyncHost = Boolean(profile && profile.id === syncHostId);

  useEffect(() => {
    if (snapshot.status !== "gameOver") {
      submittedLeaderboardRef.current = "";
      setCurrentLeaderboardId("");
    }
  }, [snapshot.status]);

  useEffect(() => {
    if (!profile || locked || snapshot.status !== "gameOver") return;

    const members = activePlayers.slice(0, 6).map((player) => ({
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      score: player.score,
      lettersTyped: player.lettersTyped,
    }));
    if (members.length === 0) {
      members.push({
        id: profile.id,
        name: profile.name,
        emoji: profile.emoji,
        score: snapshot.score,
        lettersTyped: snapshot.lettersTyped,
      });
    }

    const score = members.reduce((total, player) => total + player.score, 0) || snapshot.score;
    const lettersTyped =
      members.reduce((total, player) => total + player.lettersTyped, 0) || snapshot.lettersTyped;
    const signature = [
      session?.generation ?? profile.generation,
      snapshot.survivalTime,
      snapshot.roundNumber,
      score,
      lettersTyped,
      members.map((member) => member.id).sort().join(","),
    ].join(":");
    if (signature === submittedLeaderboardRef.current) return;

    submittedLeaderboardRef.current = signature;
    const entryId = `run-${session?.generation ?? profile.generation}-${hashSignature(signature)}`;
    setCurrentLeaderboardId(entryId);
    const captainId = members.map((member) => member.id).sort()[0];
    if (profile.id !== captainId) return;

    setDoc(
      doc(leaderboardRef, entryId),
      {
        id: entryId,
        score,
        roundNumber: snapshot.roundNumber,
        lettersTyped,
        teamLettersPerMinute: snapshot.teamLettersPerMinute,
        members,
        createdAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(console.error);
  }, [
    activePlayers,
    locked,
    profile,
    session?.generation,
    snapshot.lettersTyped,
    snapshot.roundNumber,
    snapshot.score,
    snapshot.status,
    snapshot.survivalTime,
    snapshot.teamLettersPerMinute,
  ]);

  const savePlayer = useCallback(
    async (name: string, emoji: string) => {
      if (!session || locked) return;
      const nextProfile: PlayerProfile = {
        id: profile?.id ?? loadLastPlayerId() ?? makePlayerId(),
        name: name.trim().slice(0, 18) || "Player",
        emoji,
        generation: session.generation,
      };
      setProfile(nextProfile);
      saveProfile(nextProfile);
      saveLastPlayerId(nextProfile.id);
      setDoc(
        doc(playersRef, nextProfile.id),
        {
          ...nextProfile,
          score: 0,
          streak: 0,
          lettersTyped: 0,
          accuracy: 100,
          wordsCompleted: 0,
          lastSeenMs: Date.now(),
          online: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(console.error);
    },
    [locked, profile?.id, session],
  );

  const publishSyncState = useCallback(
    (sync: GameSyncState) => {
      if (!profile || locked || !isSyncHost) return;
      const now = Date.now();
      if (now - lastSyncWriteAtRef.current < SYNC_WRITE_MS && sync.status === "playing") return;
      lastSyncWriteAtRef.current = now;
      setDoc(
        syncStateRef,
        {
          ...sync,
          generation: session?.generation ?? profile.generation,
          hostId: profile.id,
          updatedAtMs: now,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(console.error);
    },
    [isSyncHost, locked, profile, session?.generation],
  );

  const publishTextInput = useCallback(
    (value: string) => {
      if (!profile || locked || !session) return;
      const letters = [...value]
        .map((char) => char.toLowerCase())
        .filter((char) => /^[a-z]$/.test(char));
      if (letters.length === 0) return;
      const now = Date.now();
      setDoc(doc(keyEventsRef, `${now}-${profile.id}-text-${makeEventSalt()}`), {
        generation: session.generation,
        playerId: profile.id,
        playerName: profile.name,
        playerEmoji: profile.emoji,
        kind: "text",
        value: letters.join("").slice(0, 16),
        createdAtMs: now,
        createdAt: serverTimestamp(),
      }).catch(console.error);
    },
    [locked, profile, session],
  );

  const publishBackspace = useCallback(() => {
    if (!profile || locked || !session) return;
    const now = Date.now();
    setDoc(doc(keyEventsRef, `${now}-${profile.id}-backspace-${makeEventSalt()}`), {
      generation: session.generation,
      playerId: profile.id,
      playerName: profile.name,
      playerEmoji: profile.emoji,
      kind: "backspace",
      value: "",
      createdAtMs: now,
      createdAt: serverTimestamp(),
    }).catch(console.error);
  }, [locked, profile, session]);

  useEffect(() => {
    if (!profile || locked) return;

    const writePresence = () => {
      setDoc(
        doc(playersRef, profile.id),
        {
          ...profile,
          lastSeenMs: Date.now(),
          online: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(console.error);
    };

    writePresence();
    const interval = window.setInterval(writePresence, HEARTBEAT_MS);
    const markAway = () => {
      updateDoc(doc(playersRef, profile.id), { online: false, updatedAt: serverTimestamp() }).catch(
        () => undefined,
      );
    };
    window.addEventListener("beforeunload", markAway);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", markAway);
      markAway();
    };
  }, [locked, profile]);

  useEffect(() => {
    if (!profile || locked) return;
    const signature = [
      snapshot.score,
      snapshot.streak,
      snapshot.lettersTyped,
      snapshot.accuracy,
      snapshot.wordsCompleted,
      snapshot.status,
      snapshot.roundComplete,
    ].join(":");
    if (signature === lastScoreSignatureRef.current) return;
    lastScoreSignatureRef.current = signature;

    const writeScore = () => {
      lastWriteAtRef.current = Date.now();
      setDoc(
        doc(playersRef, profile.id),
        {
          ...profile,
          score: snapshot.score,
          streak: snapshot.streak,
          lettersTyped: snapshot.lettersTyped,
          accuracy: snapshot.accuracy,
          wordsCompleted: snapshot.wordsCompleted,
          lastSeenMs: Date.now(),
          online: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(console.error);
    };

    if (snapshot.status === "gameOver") {
      writeScore();
      return;
    }

    const delay = Math.max(0, SCORE_WRITE_MS - (Date.now() - lastWriteAtRef.current));
    if (writeTimerRef.current !== null) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(writeScore, delay);
    return () => {
      if (writeTimerRef.current !== null) window.clearTimeout(writeTimerRef.current);
    };
  }, [locked, profile, snapshot]);

  const requestReset = useCallback(async () => {
    if (!profile || !session || locked) return;
    const now = Date.now();
    const vote: ResetVote = {
      id: `vote-${now}`,
      requestedBy: profile.id,
      requesterName: profile.name,
      generation: session.generation,
      createdAtMs: now,
      deadlineMs: now + VOTE_WINDOW_MS,
      status: "open",
      votes: { [profile.id]: "yes" },
    };
    setSession((current) => (current ? { ...current, currentVote: vote } : current));
    updateDoc(sessionRef, {
      currentVote: vote,
      updatedAt: serverTimestamp(),
    }).catch(console.error);
  }, [locked, profile, session]);

  const castVote = useCallback(
    async (choice: VoteChoice) => {
      if (!profile || !session?.currentVote || locked) return;
      setSession((current) => {
        if (!current?.currentVote) return current;
        return {
          ...current,
          currentVote: {
            ...current.currentVote,
            votes: { ...current.currentVote.votes, [profile.id]: choice },
          },
        };
      });
      updateDoc(sessionRef, {
        [`currentVote.votes.${profile.id}`]: choice,
        updatedAt: serverTimestamp(),
      }).catch(console.error);
    },
    [locked, profile, session?.currentVote],
  );

  const finalizeVote = useCallback(async () => {
    if (locked) return;
    setSession((current) => {
      if (!current?.currentVote || current.currentVote.status !== "open") return current;
      if (Date.now() < current.currentVote.deadlineMs) return current;
      return finalizeLocalVote(current);
    });
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const vote = normalizeVote(data.currentVote);
      if (!vote || vote.status !== "open" || Date.now() < vote.deadlineMs) return;

      const peerVotes = Object.entries(vote.votes).filter(([id]) => id !== vote.requestedBy);
      const noVotes = peerVotes.filter(([, choice]) => choice === "no").length;
      const rejected = peerVotes.length > 0 && noVotes > peerVotes.length / 2;
      transaction.update(sessionRef, {
        generation: rejected ? data.generation : increment(1),
        currentVote: { ...vote, status: rejected ? "rejected" : "passed" },
        resetAtMs: rejected ? data.resetAtMs ?? null : Date.now(),
        updatedAt: serverTimestamp(),
      });
    }).catch(console.error);
  }, [locked]);

  useEffect(() => {
    const vote = session?.currentVote;
    if (!vote || vote.status !== "open") return;
    const delay = Math.max(0, vote.deadlineMs - Date.now() + 250);
    const timer = window.setTimeout(() => {
      finalizeVote().catch(console.error);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [finalizeVote, session?.currentVote]);

  return {
    activePlayers,
    castVote,
    currentLeaderboardId,
    isSyncHost,
    leaderId,
    leaderboard,
    locked,
    profile,
    publishBackspace,
    publishSyncState,
    publishTextInput,
    remoteKeyEvents,
    remoteSyncState,
    requestReset,
    savePlayer,
    session,
  };
}

function normalizeVote(value: unknown): ResetVote | null {
  if (!value || typeof value !== "object") return null;
  const vote = value as Partial<ResetVote>;
  if (!vote.id || !vote.requestedBy || !vote.deadlineMs) return null;
  return {
    id: String(vote.id),
    requestedBy: String(vote.requestedBy),
    requesterName: String(vote.requesterName ?? "Someone"),
    generation: Number(vote.generation ?? 1),
    createdAtMs: Number(vote.createdAtMs ?? Date.now()),
    deadlineMs: Number(vote.deadlineMs),
    status:
      vote.status === "passed" || vote.status === "rejected" || vote.status === "open"
        ? vote.status
        : "open",
    votes: (vote.votes ?? {}) as Record<string, VoteChoice>,
  };
}

function normalizeLeaderboardEntry(id: string, value: unknown): TeamLeaderboardEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<TeamLeaderboardEntry>;
  const rawMembers = Array.isArray(entry.members) ? entry.members : [];
  const members = rawMembers
    .map((member) => {
      if (!member || typeof member !== "object") return null;
      const typedMember = member as Partial<TeamLeaderboardEntry["members"][number]>;
      return {
        id: String(typedMember.id ?? ""),
        name: String(typedMember.name ?? "Player").slice(0, 18),
        emoji: String(typedMember.emoji ?? "🐸"),
        score: Number(typedMember.score ?? 0),
        lettersTyped: Number(typedMember.lettersTyped ?? 0),
      };
    })
    .filter((member): member is TeamLeaderboardEntry["members"][number] =>
      Boolean(member?.id),
    );

  return {
    id: String(entry.id ?? id),
    score: Number(entry.score ?? 0),
    roundNumber: Number(entry.roundNumber ?? 1),
    lettersTyped: Number(entry.lettersTyped ?? 0),
    teamLettersPerMinute: Number(entry.teamLettersPerMinute ?? 0),
    members,
    createdAtMs: Number(entry.createdAtMs ?? 0),
  };
}

function normalizeSyncState(value: unknown): GameSyncState | null {
  if (!value || typeof value !== "object") return null;
  const sync = value as Partial<GameSyncState>;
  return {
    generation: Number(sync.generation ?? 1),
    hostId: String(sync.hostId ?? ""),
    status:
      sync.status === "playing" ||
      sync.status === "paused" ||
      sync.status === "gameOver" ||
      sync.status === "title"
        ? sync.status
        : "title",
    elapsedSeconds: Number(sync.elapsedSeconds ?? 0),
    score: Number(sync.score ?? 0),
    lives: Number(sync.lives ?? 3),
    streak: Number(sync.streak ?? 0),
    longestStreak: Number(sync.longestStreak ?? 0),
    level: Number(sync.level ?? 1),
    teamLettersPerMinute: Number(sync.teamLettersPerMinute ?? 0),
    roundNumber: Number(sync.roundNumber ?? 1),
    roundPhase:
      sync.roundPhase === "swarm" ||
      sync.roundPhase === "bossWarning" ||
      sync.roundPhase === "boss" ||
      sync.roundPhase === "intro"
        ? sync.roundPhase
        : "intro",
    phaseStartedAt: Number(sync.phaseStartedAt ?? 0),
    bossWarningPlayed: Boolean(sync.bossWarningPlayed),
    lettersTyped: Number(sync.lettersTyped ?? 0),
    correctLetters: Number(sync.correctLetters ?? 0),
    wrongLetters: Number(sync.wrongLetters ?? 0),
    wordsCompleted: Number(sync.wordsCompleted ?? 0),
    teamFlyCount: Number(sync.teamFlyCount ?? 0),
    croakedPlayerIds: Array.isArray(sync.croakedPlayerIds)
      ? sync.croakedPlayerIds.map(String)
      : [],
    playerMissCounts:
      sync.playerMissCounts && typeof sync.playerMissCounts === "object"
        ? Object.fromEntries(
            Object.entries(sync.playerMissCounts).map(([id, count]) => [id, Number(count ?? 0)]),
          )
        : {},
    roundComplete: Boolean(sync.roundComplete),
    adaptivePressure: Number(sync.adaptivePressure ?? 0),
    recoveryUntilSeconds: Number(sync.recoveryUntilSeconds ?? 0),
    recoveryWordsRemaining: Number(sync.recoveryWordsRemaining ?? 0),
    lastSpawnAt: Number(sync.lastSpawnAt ?? 0),
    spawnIntervalMs: Number(sync.spawnIntervalMs ?? 3000),
    lastDamageAt: Number(sync.lastDamageAt ?? -999),
    creatures: Array.isArray(sync.creatures)
      ? sync.creatures.map(normalizeCreature).filter((creature): creature is Creature => Boolean(creature))
      : [],
    updatedAtMs: Number(sync.updatedAtMs ?? 0),
  };
}

function normalizeCreature(value: unknown): Creature | null {
  if (!value || typeof value !== "object") return null;
  const creature = value as Partial<Creature>;
  if (!creature.id || !creature.word) return null;
  return {
    id: String(creature.id),
    word: String(creature.word),
    displayText: String(creature.displayText ?? creature.word),
    band: creature.band === "g35" || creature.band === "g68" || creature.band === "k2" ? creature.band : "k2",
    assignedPlayerId:
      typeof creature.assignedPlayerId === "string" ? creature.assignedPlayerId : null,
    assignedPlayerName: String(creature.assignedPlayerName ?? ""),
    assignedPlayerEmoji: String(creature.assignedPlayerEmoji ?? ""),
    bonus: Boolean(creature.bonus),
    recovery: Boolean(creature.recovery),
    boss: Boolean(creature.boss),
    typedIndex: Number(creature.typedIndex ?? 0),
    tier: creature.tier === 2 || creature.tier === 3 ? creature.tier : 1,
    x: Number(creature.x ?? 0),
    y: Number(creature.y ?? 0),
    radius: Number(creature.radius ?? 34),
    speed: Number(creature.speed ?? 20),
    alive: creature.alive !== false,
    active: Boolean(creature.active),
    breached: Boolean(creature.breached),
    createdAt: Number(creature.createdAt ?? 0),
    wobbleSeed: Number(creature.wobbleSeed ?? 0),
    color: String(creature.color ?? "#f0b429"),
  };
}

function normalizeKeyEvent(id: string, value: unknown): RemoteKeyEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<RemoteKeyEvent>;
  if (!event.playerId) return null;
  const kind = event.kind === "backspace" ? "backspace" : "text";
  return {
    id,
    generation: Number(event.generation ?? 1),
    playerId: String(event.playerId),
    playerName: String(event.playerName ?? "Player"),
    playerEmoji: String(event.playerEmoji ?? "🐸"),
    kind,
    value: kind === "text" ? String(event.value ?? "").slice(0, 16).toLowerCase() : "",
    createdAtMs: Number(event.createdAtMs ?? 0),
  };
}

function makePlayerId() {
  if ("crypto" in window && "randomUUID" in window.crypto) return window.crypto.randomUUID();
  return `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadProfile(): PlayerProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerProfile;
    if (!parsed.id || !parsed.name || !parsed.emoji) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveProfile(profile: PlayerProfile | null) {
  try {
    if (profile) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    // localStorage may be unavailable in private or embedded contexts.
  }
}

function loadLastPlayerId() {
  try {
    return window.localStorage.getItem(`${PROFILE_KEY}.id`);
  } catch {
    return null;
  }
}

function saveLastPlayerId(id: string) {
  try {
    window.localStorage.setItem(`${PROFILE_KEY}.id`, id);
  } catch {
    // localStorage may be unavailable in private or embedded contexts.
  }
}

function makeEventSalt() {
  return Math.random().toString(36).slice(2, 8);
}

function hashSignature(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createLocalSession(): SessionMeta {
  const now = Date.now();
  return {
    id: SESSION_ID,
    generation: 1,
    createdAtMs: now,
    expiresAtMs: now + SESSION_DAYS * 24 * 60 * 60 * 1000,
    locked: false,
    currentVote: null,
  };
}

function finalizeLocalVote(session: SessionMeta): SessionMeta {
  const vote = session.currentVote;
  if (!vote) return session;
  const peerVotes = Object.entries(vote.votes).filter(([id]) => id !== vote.requestedBy);
  const noVotes = peerVotes.filter(([, choice]) => choice === "no").length;
  const rejected = peerVotes.length > 0 && noVotes > peerVotes.length / 2;

  return {
    ...session,
    generation: rejected ? session.generation : session.generation + 1,
    currentVote: { ...vote, status: rejected ? "rejected" : "passed" },
  };
}
