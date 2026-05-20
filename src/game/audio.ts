import type { GameSettings } from "./types";

export class AudioSystem {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicLevel = 1;

  play(
    kind: "shoot" | "hit" | "damage" | "gameOver" | "croak" | "bossWarning",
    settings: GameSettings,
  ) {
    if (!settings.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (kind === "croak") {
      this.playCroak(ctx);
      return;
    }
    if (kind === "bossWarning") {
      this.playBossWarning(ctx);
      return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const config = {
      shoot: { frequency: 520, duration: 0.055, volume: 0.035 },
      hit: { frequency: 760, duration: 0.09, volume: 0.06 },
      damage: { frequency: 130, duration: 0.18, volume: 0.075 },
      gameOver: { frequency: 82, duration: 0.35, volume: 0.07 },
    }[kind];

    oscillator.type = kind === "damage" || kind === "gameOver" ? "sawtooth" : "square";
    oscillator.frequency.setValueAtTime(config.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(40, config.frequency * 0.55),
      now + config.duration,
    );
    gain.gain.setValueAtTime(config.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + config.duration);
  }

  startMusic(settings: GameSettings, level = 1) {
    if (!settings.soundEnabled) {
      this.stopMusic();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => undefined);

    this.musicLevel = level;
    if (this.musicGain && this.musicTimer !== null) return;

    this.musicGain = ctx.createGain();
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.setValueAtTime(930, ctx.currentTime);
    this.musicFilter.Q.setValueAtTime(0.42, ctx.currentTime);
    this.musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.musicGain.gain.exponentialRampToValueAtTime(0.048, ctx.currentTime + 0.55);
    this.musicGain.connect(this.musicFilter);
    this.musicFilter.connect(ctx.destination);
    this.musicStep = 0;
    this.scheduleMusicStep();
  }

  updateMusic(settings: GameSettings, level: number) {
    if (!settings.soundEnabled) {
      this.stopMusic();
      return;
    }
    if (this.musicTimer === null) return;
    this.musicLevel = level;
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }

    if (!this.context || !this.musicGain) return;
    const gain = this.musicGain;
    const filter = this.musicFilter;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    window.setTimeout(() => {
      gain.disconnect();
      if (filter) {
        filter.disconnect();
      }
      if (this.musicFilter === filter) {
        this.musicFilter = null;
      }
      if (this.musicGain === gain) this.musicGain = null;
    }, 320);
  }

  dispose() {
    this.stopMusic();
  }

  private ensureContext() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    this.context ??= new AudioContextCtor();
    return this.context;
  }

  private scheduleMusicStep() {
    if (!this.context || !this.musicGain) return;
    const now = this.context.currentTime;
    const tempoLift = Math.min(0.028, this.musicLevel * 0.0028);
    const stepLength = Math.max(0.135, 0.205 - tempoLift);
    const melody = [
      76, 79, 81, 79, 76, 74, 72, 74,
      76, 74, 72, 69, 71, 72, 74, 76,
      79, 81, 83, 81, 79, 76, 74, 76,
      79, 76, 74, 72, 71, 72, 74, 76,
    ];
    const bass = [52, 52, 55, 55, 57, 57, 59, 59];
    const step = this.musicStep % melody.length;

    this.playMusicNote(melody[step], stepLength * 0.84, "triangle", 0.115, now);
    if (step % 2 === 0) {
      this.playMusicNote(
        melody[(step + 5) % melody.length] - 12,
        stepLength * 0.52,
        "sine",
        0.048,
        now,
      );
    }
    if (step % 4 === 0) {
      this.playMusicNote(
        bass[Math.floor(step / 4) % bass.length],
        stepLength * 2.6,
        "triangle",
        0.092,
        now,
      );
    }

    this.musicStep += 1;
    this.musicTimer = window.setTimeout(() => this.scheduleMusicStep(), stepLength * 1000);
  }

  private playMusicNote(
    midi: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    startTime: number,
  ) {
    if (!this.context || !this.musicGain) return;
    const oscillator = this.context.createOscillator();
    const warmOscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const warmGain = this.context.createGain();
    oscillator.type = type;
    warmOscillator.type = "sine";
    oscillator.detune.setValueAtTime(type === "triangle" ? -13 : -6, startTime);
    warmOscillator.detune.setValueAtTime(9, startTime);
    const frequency = midiToFrequency(midi);
    oscillator.frequency.setValueAtTime(frequency, startTime);
    warmOscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    warmGain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
    warmGain.gain.exponentialRampToValueAtTime(volume * 0.28, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    warmGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 1.08);
    oscillator.connect(gain);
    warmOscillator.connect(warmGain);
    gain.connect(this.musicGain);
    warmGain.connect(this.musicGain);
    oscillator.start(startTime);
    warmOscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
    warmOscillator.stop(startTime + duration + 0.05);
  }

  private playCroak(ctx: AudioContext) {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(118, now);
    oscillator.frequency.exponentialRampToValueAtTime(72, now + 0.18);
    oscillator.frequency.exponentialRampToValueAtTime(96, now + 0.34);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(260, now + 0.32);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.38);
  }

  private playBossWarning(ctx: AudioContext) {
    const now = ctx.currentTime;
    [0, 0.42, 0.84].forEach((offset, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime([220, 196, 146][index], now + offset);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(700, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.34);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.38);
    });
  }
}

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
