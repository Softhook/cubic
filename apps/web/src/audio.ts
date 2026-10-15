// The Web Audio plumbing every synthesized sound shares (sound.ts, gameOverSound.ts): the context, the
// output bus, white noise and a few node builders.

let ctx: AudioContext | null = null;
let bus: AudioNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Where every sound goes: a gentle compressor, so several sounds at once don't clip. */
export function out(ac: AudioContext): AudioNode {
  if (!bus) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ac.destination);
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

/** `x` give or take a fraction `by`, so repeated sounds vary. */
export const jitter = (x: number, by = 0.08) => x * (1 + (Math.random() * 2 - 1) * by);
