// The Web Audio plumbing every synthesized sound shares (sound.ts, gameOverSound.ts, ambience.ts,
// openingSound.ts): the context, the output bus, white noise, a reverb and a few node builders, and the
// player's sound and music switches.

import { remember, stored } from './storage';

/** The two switches in the game's top bar: sound effects, and the music (ambience.ts). */
type Switch = 'sound' | 'music';

let ctx: AudioContext | null = null;
let bus: AudioNode | null = null;
let effectsGain: GainNode | null = null;
const switches: Record<Switch, boolean> = {
  sound: stored('quantum.sound') !== 'off',
  music: stored('quantum.music') !== 'off',
};
const listeners = new Set<() => void>();
let noiseBuf: AudioBuffer | null = null;
let impulse: AudioBuffer | null = null;

export function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Whether sound effects or music are on, as the player last set them (kept across visits). */
export function isOn(which: Switch): boolean {
  return switches[which];
}

export function turn(which: Switch, on: boolean) {
  if (switches[which] === on) return;
  switches[which] = on;
  remember(`quantum.${which}`, on ? 'on' : 'off');
  if (which === 'sound' && ctx && effectsGain) effectsGain.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  if (on) audio();
  listeners.forEach((l) => l());
}

/** Calls `listener` whenever sound effects or music are turned on or off; returns the way to stop. */
export function onSwitch(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Where every sound effect goes: a gentle compressor, so several sounds at once don't clip, then silence while sound is off. */
export function out(ac: AudioContext): AudioNode {
  if (!bus) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    effectsGain = gain(ac, switches.sound ? 1 : 0);
    comp.connect(effectsGain).connect(ac.destination);
    bus = comp;
  }
  return bus;
}

// Starting the audio can take ~100 ms: it is done when the page is next idle after the first touch or key
// (browsers only let sound start after one), not inside the tap that first plays a sound.
function warm() {
  window.removeEventListener('pointerdown', warm, true);
  window.removeEventListener('keydown', warm, true);
  if ('requestIdleCallback' in window) requestIdleCallback(() => audio(), { timeout: 1000 });
  else setTimeout(audio, 0);
}
window.addEventListener('pointerdown', warm, true);
window.addEventListener('keydown', warm, true);

/** Two seconds of white noise, made once and reused by every noise sound. */
function whiteNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** Sets `param` to `from` at `at`, then glides through `points`, each [seconds after `at`, value], exponentially (as pitch and loudness are heard). */
export function glide(param: AudioParam, at: number, from: number, points: [number, number][]) {
  param.setValueAtTime(from, at);
  for (const [t, v] of points) param.exponentialRampToValueAtTime(Math.max(v, 0.0001), at + t);
}

/** A gain that rises from silence through `points`, as `glide` takes them; end on 0 to fade out. */
export function contour(ac: AudioContext, at: number, points: [number, number][]): GainNode {
  const g = ac.createGain();
  glide(g.gain, at, 0.0001, points);
  return g;
}

/** Gain that swells from silence to `peak` at `at + rise`, then fades out by `at + dur`. */
export function envelope(ac: AudioContext, at: number, dur: number, peak: number, rise = 0.01): GainNode {
  return contour(ac, at, [
    [rise, peak],
    [dur, 0],
  ]);
}

/** An oscillator playing from `at` to `end`; ramp its frequency from `at` on. */
export function oscillator(ac: AudioContext, type: OscillatorType, freq: number, at: number, end: number): OscillatorNode {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  osc.start(at);
  osc.stop(end);
  return osc;
}

/** White noise from `at` to `end`. It starts at a random point so repeats don't sound identical, and loops to cover any sound that runs past its end. */
export function noiseSource(ac: AudioContext, at: number, end: number): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = whiteNoise(ac);
  src.loop = true;
  src.start(at, Math.random());
  src.stop(end);
  return src;
}

export function filter(ac: AudioContext, type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** A gain node at `level`. */
export function gain(ac: AudioContext, level: number): GainNode {
  const g = ac.createGain();
  g.gain.value = level;
  return g;
}

/** A MIDI note's frequency: 69 is the A above middle C. */
export const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** A long, dark stereo reverb: a six-second tail, made once and shared (the music and its opening). */
export function reverb(ac: AudioContext): ConvolverNode {
  if (impulse?.sampleRate !== ac.sampleRate) {
    const len = Math.floor(ac.sampleRate * 6);
    impulse = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ac.sampleRate;
        // Smoothed noise, so the tail is soft rather than hissy.
        last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
        data[i] = last * Math.exp(-t / 1.7) * Math.min(1, t * 8);
      }
    }
  }
  const conv = ac.createConvolver();
  conv.buffer = impulse;
  return conv;
}

/** `x` give or take a fraction `by`, so repeated sounds vary. */
export const jitter = (x: number, by = 0.08) => x * (1 + (Math.random() * 2 - 1) * by);
