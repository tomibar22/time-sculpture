/**
 * Shared AudioContext, created and woken inside a user gesture (required on iOS).
 *
 * iOS: when the app leaves the screen the context is suspended or "interrupted", and after it
 * comes back a resumed context may say "running" yet stay silent. So a context that has been in
 * the background is never trusted again: the next tap or key builds a fresh one, inside that
 * gesture, where iOS allows it to sound.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** The app was hidden since this context was made: replace it on the next gesture. */
let stale = false;
let noiseBuf: AudioBuffer | null = null;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function build(): AudioContext | null {
  const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AC) return null;
  const c = new AC();
  const m = c.createGain();
  m.gain.value = 0.9;
  // a gentle limiter: many voices on one pulse (click + stroke + landing) never clip
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 12;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  m.connect(limiter).connect(c.destination);
  // iPhone / iPad: play like a music app, so the ring/silent switch does not mute the piece
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      session.type = 'playback';
    } catch {
      /* an older Safari: the switch keeps muting, nothing else changes */
    }
  }
  ctx = c;
  master = m;
  noiseBuf = null;
  stale = false;
  return c;
}

/** iOS: a silent sound played inside the gesture is what lets the context sound at all. */
function prime(c: AudioContext): void {
  const s = c.createBufferSource();
  s.buffer = c.createBuffer(1, 1, 22050);
  s.connect(c.destination);
  s.start(0);
}

export function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx || ctx.state === 'closed') return build();
  // 'suspended' before the first gesture; iOS also reports 'interrupted' after a call or Siri
  if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  return ctx;
}

/**
 * Inside a gesture: make sure the audio can sound. A context from before the app was hidden (or
 * one that will not run) is closed and a fresh one built and primed; otherwise it is woken.
 */
function wake(): void {
  if (ctx && (stale || (ctx.state as string) === 'interrupted')) {
    const old = ctx;
    ctx = null;
    void old.close().catch(() => undefined);
  }
  const c = ensureAudio();
  if (c) prime(c);
}

export function audioNow(): number {
  return ctx ? ctx.currentTime : 0;
}

/**
 * Wake the audio on every pointer or key gesture (before the app's own handlers, so Play finds
 * it ready), and mark it stale whenever the app is hidden.
 */
export function installAudioUnlock(): void {
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
  window.addEventListener('touchend', wake, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && ctx) {
      stale = true;
      void ctx.suspend().catch(() => undefined);
    }
  });
  // a page restored from the back-forward cache is like coming back from the background
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && ctx) stale = true;
  });
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

/**
 * A short burst of filtered noise (the skin and the fingers of a drum stroke): white noise
 * through a band-pass at `f` (Hz, width `q`), with a fast attack and an exponential decay.
 */
export function noise(t: number, f: number, q: number, gain: number, dur: number): void {
  if (!ctx || !master) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  // a different stretch of the noise each time, so repeated strokes are not identical
  const offset = Math.random() * 0.3;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = f;
  band.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(band).connect(g).connect(master);
  src.start(t, offset, dur + 0.03);
}
