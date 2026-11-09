/** Shared AudioContext, created and resumed on the first user gesture (required on iOS). */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    // a gentle limiter: many voices on one pulse (click + tone + landing) never clip
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master.connect(limiter).connect(ctx.destination);
    // iPhone / iPad: play like a music app, so the ring/silent switch does not mute the piece
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = 'playback';
      } catch {
        /* an older Safari: the switch keeps muting, nothing else changes */
      }
    }
  }
  // 'suspended' before the first gesture; iOS also reports 'interrupted' after a call or Siri
  if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => undefined);
  return ctx;
}

export function audioNow(): number {
  return ctx ? ctx.currentTime : 0;
}

/** Unlock on the first pointer/key gesture anywhere. */
export function installAudioUnlock(): void {
  const unlock = () => {
    const c = ensureAudio();
    if (c) {
      // iOS: play a silent buffer inside the gesture
      const b = c.createBuffer(1, 1, 22050);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start(0);
    }
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/** A short enveloped oscillator note. f1 = optional glide target. */
export function tone(
  t: number,
  type: OscillatorType,
  f: number,
  gain: number,
  dur: number,
  f1?: number,
): void {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}
