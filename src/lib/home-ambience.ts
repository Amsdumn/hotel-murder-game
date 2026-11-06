import { getAudioContext } from "./game-sound";

export function startHomeAmbience(): () => void {
  const context = getAudioContext();
  if (!context) return () => {};
  const master = context.createGain();
  master.gain.value = 0.012;
  master.connect(context.destination);
  const voices = [110, 164.81, 220].map((frequency) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(master);
    oscillator.start();
    return oscillator;
  });
  const pulse = context.createOscillator();
  const pulseDepth = context.createGain();
  pulse.type = "sine";
  pulse.frequency.value = 0.09;
  pulseDepth.gain.value = 0.003;
  pulse.connect(pulseDepth).connect(master.gain);
  pulse.start();
  return () => {
    for (const oscillator of [...voices, pulse]) {
      oscillator.stop();
      oscillator.disconnect();
    }
    pulseDepth.disconnect();
    master.disconnect();
  };
}
