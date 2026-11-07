import type { GamePhase } from "@/types/game";
import { mediaUrl } from "./media-url";

export type GameSoundCue = "start" | "skill" | "vote" | "room" | "result" | "murder";

export interface GameSoundSnapshot {
  code: string;
  phase: GamePhase;
  turn: number;
  canUseSkill: boolean;
  playerId?: string;
  phaseDeadlineAt?: number;
  resultReady: boolean;
  openedRoomCount: number;
}

export function getGameSoundEvent(previous: GameSoundSnapshot | null, current: GameSoundSnapshot): { cue: GameSoundCue; key: string } | null {
  if (!previous || previous.code !== current.code) {
    return current.phase === "ROLE_REVEAL" ? { cue: "start", key: `${current.code}:start` } : null;
  }
  if (current.phase === "FINISHED" && current.resultReady && (previous.phase !== "FINISHED" || !previous.resultReady)) return { cue: "result", key: `${current.code}:result` };
  if (current.phase === "RESOLUTION" && current.openedRoomCount > previous.openedRoomCount) return { cue: "room", key: `${current.code}:room:${current.turn}:${current.openedRoomCount}` };
  if (current.phase === "VOTING" && (previous.phase !== "VOTING" || previous.phaseDeadlineAt !== current.phaseDeadlineAt)) return { cue: "vote", key: `${current.code}:vote:${current.turn}:${current.phaseDeadlineAt ?? "unknown"}` };
  if (current.phase === "SKILL_PHASE" && current.canUseSkill && current.playerId && (!previous.canUseSkill || previous.turn !== current.turn || previous.playerId !== current.playerId)) return { cue: "skill", key: `${current.code}:skill:${current.turn}:${current.playerId}` };
  return null;
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  try { return audioContext ?? (audioContext = new window.AudioContext()); } catch { return null; }
}

export function primeGameAudio(): void {
  const context = getAudioContext();
  if (context?.state === "suspended") void context.resume().catch(() => {});
}

const motifs: Record<Exclude<GameSoundCue, "murder">, Array<[frequency: number, duration: number, delay: number, volume: number]>> = {
  start: [[392, 0.32, 0, 0.055], [523, 0.42, 0.17, 0.05], [659, 0.55, 0.35, 0.045]],
  skill: [[587, 0.2, 0, 0.06], [784, 0.38, 0.16, 0.05]],
  vote: [[440, 0.16, 0, 0.045], [440, 0.16, 0.22, 0.045], [554, 0.3, 0.44, 0.045]],
  room: [[330, 0.22, 0, 0.055], [247, 0.38, 0.18, 0.05], [196, 0.52, 0.38, 0.04]],
  result: [[392, 0.4, 0, 0.055], [494, 0.4, 0.24, 0.05], [587, 0.7, 0.48, 0.05]],
};

export function playGameSound(cue: GameSoundCue): void {
  if (cue === "murder") {
    if (typeof Audio === "undefined") return;
    const audio = new Audio(mediaUrl("/sound-effect/sounded-kill.mp3"));
    audio.volume = 1;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
    return;
  }
  const context = getAudioContext();
  if (!context) return;
  const play = () => {
    if (context.state !== "running") return;
    for (const [frequency, duration, delay, volume] of motifs[cue]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;
      oscillator.type = cue === "room" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }
  };
  if (context.state === "running") play();
  else void context.resume().then(play).catch(() => {});
}
