/** Retained short synthesized MVP feedback; the native forest mixer lives in audio.ts. */
let audio: AudioContext | undefined;
export function playSound(
  kind:
    | "shutter"
    | "whistle"
    | "notice"
    | "rattle"
    | "impact"
    | "alert"
    | "footstep",
  volume: number,
) {
  if (volume <= 0) return;
  audio ??= new AudioContext();
  void audio.resume();
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.connect(gain);
  gain.connect(audio.destination);
  const t = audio.currentTime;
  oscillator.type = ["shutter", "rattle", "impact"].includes(kind)
    ? "square"
    : "sine";
  oscillator.frequency.setValueAtTime(
    kind === "whistle"
      ? 1200
      : kind === "shutter"
        ? 150
        : kind === "rattle"
          ? 260
          : kind === "impact"
            ? 90
            : kind === "footstep"
              ? 70
              : 420,
    t,
  );
  oscillator.frequency.exponentialRampToValueAtTime(
    kind === "whistle" ? 1600 : kind === "alert" ? 750 : 80,
    t + 0.12,
  );
  gain.gain.setValueAtTime(volume * 0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  oscillator.start(t);
  oscillator.stop(t + 0.16);
}
