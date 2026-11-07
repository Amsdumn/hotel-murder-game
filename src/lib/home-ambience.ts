import { mediaUrl } from "./media-url";

export const HOME_AMBIENCE_SRC = mediaUrl("/sound-effect/sound-bg-horror-trailer.mp3");

export function startHomeAmbience(audio: HTMLAudioElement): () => void {
  audio.loop = true;
  audio.volume = 0.35;
  let stopped = false;

  const play = () => {
    if (stopped || document.hidden) return;
    void audio.play().catch(() => { /* Retry after the next user gesture. */ });
  };
  const onVisibilityChange = () => {
    if (document.hidden) audio.pause();
    else play();
  };

  document.addEventListener("pointerdown", play);
  document.addEventListener("keydown", play);
  document.addEventListener("visibilitychange", onVisibilityChange);
  play();

  return () => {
    stopped = true;
    document.removeEventListener("pointerdown", play);
    document.removeEventListener("keydown", play);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    audio.pause();
    audio.currentTime = 0;
  };
}
