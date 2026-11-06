export const HOME_AMBIENCE_SRC = "/sound-effect/sound-bg-horror-trailer.mp3";
// Sound Effect by <a href="https://pixabay.com/users/simplesound-53070346/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=443327">SimpleSound</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=443327">Pixabay</a>

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
