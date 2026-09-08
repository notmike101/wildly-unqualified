/**
Retained short synthesized MVP feedback; the native forest mixer lives in audio.ts.
 */
let audio: AudioContext | undefined;

/**
 * Play the retained short synthesized feedback tone through a shared lazy AudioContext.
 * Nonpositive volume is silent; this path is separate from the forest audio mixer.
 *
 * @param kind - Feedback cue kind
 * @param volume - Caller-supplied volume multiplier
 * @throws {Error} AudioContext or oscillator setup fails.
 */
export function playSound(
    kind:
        | 'shutter'
        | 'whistle'
        | 'notice'
        | 'rattle'
        | 'impact'
        | 'alert'
        | 'footstep',
    volume: number,
) {
    if (volume <= 0) return;
    // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- The shared context is initialized only after a user gesture.
    audio ??= new AudioContext();
    void audio.resume();
    const oscillator = audio.createOscillator(),
        gain = audio.createGain();

    oscillator.connect(gain);
    gain.connect(audio.destination);
    const t = audio.currentTime;

    oscillator.type = ['shutter', 'rattle', 'impact'].includes(kind)
        ? 'square'
        : 'sine';
    oscillator.frequency.setValueAtTime(
        ({ whistle: 1200, shutter: 150, rattle: 260, impact: 90, footstep: 70, notice: 420, alert: 420 })[kind],
        t,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
        kind === 'whistle' ? 1600 : (kind === 'alert' ? 750 : 80),
        t + 0.12,
    );
    gain.gain.setValueAtTime(volume * 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    oscillator.start(t);
    oscillator.stop(t + 0.16);
}
