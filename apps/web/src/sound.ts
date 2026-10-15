// Tiny synthesized sound kit (no audio files). All sounds are short and quiet.

let ctx: AudioContext | null = null;
let bus: AudioNode | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Where every sound goes: a gentle compressor, so several sounds at once don't clip. */
function out(ac: AudioContext): AudioNode {
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

let noiseBuf: AudioBuffer | null = null;
let clickBufs: { sampleRate: number; buffers: AudioBuffer[] } | null = null;

/** Two seconds of white noise, made once and reused by every noise sound. */
function whiteNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** A few short random click samples reused by every dice clatter. */
function clickBuffers(ac: AudioContext): AudioBuffer[] {
  if (!clickBufs || clickBufs.sampleRate !== ac.sampleRate) {
    const len = 0.035;
    const size = Math.floor(ac.sampleRate * len);
    const buffers = Array.from({ length: 8 }, () => {
      const buf = ac.createBuffer(1, size, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
      return buf;
    });
    clickBufs = { sampleRate: ac.sampleRate, buffers };
  }
  return clickBufs.buffers;
}

function click(ac: AudioContext, at: number, gain: number, freq: number) {
  const buffers = clickBuffers(ac);
  const src = ac.createBufferSource();
  src.buffer = buffers[Math.floor(Math.random() * buffers.length)];
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 2.5;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(out(ac));
  src.start(at);
}

/** A click `delay` seconds from now, as `tone` and `noise` take theirs. */
function tick(gain: number, freq: number, delay = 0) {
  const ac = audio();
  if (ac) click(ac, ac.currentTime + delay, gain, freq);
}

/** Dice clattering on a table: clicks that slow down and soften. */
export function playRoll(count = 1) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  let t = 0;
  const hits = 7 + count * 2;
  for (let i = 0; i < hits; i++) {
    t += 0.035 + i * 0.012 + Math.random() * 0.03;
    click(ac, now + t, 0.22 * (1 - i / hits) + 0.03, 1800 + Math.random() * 2200);
  }
}

/** Gain that swells from silence to `peak` at `at + rise`, then fades out by `at + dur`. */
function envelope(ac: AudioContext, at: number, dur: number, peak: number, rise = 0.01): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + rise);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  return g;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number, rise = 0.01) {
  const ac = audio();
  if (!ac) return;
  const at = ac.currentTime + delay;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  osc.connect(envelope(ac, at, dur, gain, rise)).connect(out(ac));
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Filtered noise whose filter sweeps from `from` to `to` Hz: whooshes, hisses and booms. */
function noise(
  dur: number,
  gain: number,
  {
    delay = 0,
    type = 'bandpass',
    from = 1000,
    to = from,
    q = 1,
    rise = 0.01,
  }: {
    delay?: number;
    type?: BiquadFilterType;
    from?: number;
    to?: number;
    q?: number;
    rise?: number;
  } = {},
) {
  const ac = audio();
  if (!ac) return;
  const at = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = whiteNoise(ac);
  // Starts at a random point so repeats don't sound identical; looping covers any sound that runs past the end.
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + dur);
  src
    .connect(filter)
    .connect(envelope(ac, at, dur, gain, rise))
    .connect(out(ac));
  src.start(at, Math.random());
  src.stop(at + dur + 0.05);
}

const jitter = (x: number, by = 0.08) => x * (1 + (Math.random() * 2 - 1) * by);

/** A low boom with a crackling tail. */
function boom(delay = 0, size = 1) {
  noise(0.7 * size, 0.5, { delay, type: 'lowpass', from: 1800, to: 80, q: 0.7, rise: 0.005 });
  tone(jitter(110), 0.55 * size, 'sine', 0.3, delay, 32, 0.005);
  noise(0.35, 0.08, { delay: delay + 0.08, type: 'highpass', from: 3000, to: 1200, rise: 0.02 });
}

export const sfx = {
  select: () => tone(880, 0.07, 'sine', 0.05),
  /** It's your move (online): two soft notes rising. `level` turns it down (in the game, where the player is watching). */
  yourMove: (level = 1) => {
    tone(784, 0.22, 'sine', 0.06 * level, 0, undefined, 0.01);
    tone(1175, 0.4, 'sine', 0.05 * level, 0.15, undefined, 0.01);
  },
  /** A ship flying across the board: a deep engine rumble that swells as it passes. */
  fly: () => {
    const f = jitter(1);
    noise(0.6, 0.3, { type: 'lowpass', from: 160 * f, to: 520 * f, q: 3, rise: 0.25 });
    tone(48 * f, 0.6, 'sine', 0.16, 0, 72 * f, 0.2);
    tone(96 * f, 0.55, 'triangle', 0.05, 0.02, 140 * f, 0.2);
  },
  /** A ship arriving on the board from the scrapyard or reserve: a rising shimmer that lands. */
  warpIn: () => {
    tone(300, 0.35, 'sine', 0.05, 0, 1300, 0.12);
    tone(450, 0.35, 'triangle', 0.025, 0.02, 1950, 0.12);
    noise(0.35, 0.05, { type: 'highpass', from: 2000, to: 7000, rise: 0.25 });
    tone(180, 0.12, 'sine', 0.12, 0.33, 120);
  },
  /** Two ships trading places: two tones crossing. */
  swap: () => {
    tone(500, 0.3, 'sine', 0.05, 0, 1100);
    tone(1100, 0.3, 'sine', 0.05, 0, 500);
    noise(0.3, 0.05, { type: 'bandpass', from: 900, to: 2600, q: 3, rise: 0.12 });
  },
  /** A ship number changed without a roll: a mechanical servo. */
  retune: () => {
    tone(220, 0.07, 'square', 0.025, 0, 330);
    tone(330, 0.09, 'square', 0.025, 0.08, 440);
    noise(0.04, 0.1, { delay: 0.17, type: 'bandpass', from: 3200, q: 2.5, rise: 0.003 });
  },
  /** A ship destroyed. `count` > 1 stagger a few booms. */
  explode: (count = 1) => {
    for (let i = 0; i < Math.min(count, 3); i++) boom(i * 0.16, i ? 0.8 : 1);
  },
  repel: () => tone(300, 0.2, 'square', 0.03, 0, 180),
  /** A missile fired: ignition, a screaming climb with a hissing trail, then the impact. */
  missile: () => {
    noise(0.12, 0.25, { type: 'lowpass', from: 900, to: 300, rise: 0.003 });
    tone(260, 0.55, 'sawtooth', 0.03, 0.03, 1800, 0.05);
    noise(0.6, 0.12, { delay: 0.03, type: 'bandpass', from: 1200, to: 5000, q: 1.2, rise: 0.08 });
    boom(0.62, 0.7);
  },
  /** Missiles gained: two metal clunks of rounds racked into place. */
  missileLoad: () => {
    for (const d of [0, 0.14]) {
      tone(190, 0.09, 'triangle', 0.1, d, 140);
      noise(0.05, 0.12, { delay: d, type: 'bandpass', from: 3400, q: 6, rise: 0.003 });
    }
  },
  cube: () => {
    tone(660, 0.18, 'sine', 0.07);
    tone(990, 0.3, 'sine', 0.06, 0.09);
  },
  /** A card taken: a paper flick. */
  card: () => {
    noise(0.08, 0.1, { type: 'highpass', from: 2500, to: 5000, rise: 0.005 });
    tone(520, 0.12, 'triangle', 0.04, 0.02, 700);
  },
  /** Cards discarded: a downward paper swish. */
  discard: () => noise(0.25, 0.08, { type: 'bandpass', from: 5000, to: 1200, q: 0.8, rise: 0.05 }),
  /** Research breakthrough: a sparkling rising arpeggio. */
  breakthrough: () => [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.25, 'sine', 0.045, i * 0.06)),
  /** Infamy: an ominous low brass chord. */
  infamy: () => [110, 165, 131].forEach((f, i) => tone(f, 1.1, 'sawtooth', 0.035, i * 0.05, undefined, 0.15)),
  /** A skill used: a bright power-up zap. */
  skill: () => {
    tone(660, 0.12, 'triangle', 0.05, 0, 1320);
    tone(1320, 0.18, 'sine', 0.035, 0.08, 1760);
  },
  /** A Warp Gate opening: a wobbling hum that swells. */
  portal: () => {
    tone(110, 0.9, 'sine', 0.08, 0, 220, 0.3);
    tone(113, 0.9, 'sine', 0.08, 0, 226, 0.3);
    noise(0.9, 0.06, { type: 'bandpass', from: 300, to: 3000, q: 4, rise: 0.5 });
  },

  // Tactics and Gambits: a signature sound each, played as the card resolves.
  /** Aggression: war drums. */
  drums: () => {
    for (const d of [0, 0.18, 0.3, 0.42]) {
      tone(95, 0.22, 'sine', 0.22, d, 45, 0.004);
      noise(0.08, 0.1, { delay: d, type: 'lowpass', from: 900, rise: 0.003 });
    }
  },
  /** Black Market: coins changing hands (the missiles' own sound follows). */
  coins: () => {
    for (const d of [0, 0.07, 0.16]) {
      tone(jitter(2600, 0.05), 0.15, 'sine', 0.03, d);
      tone(jitter(3900, 0.05), 0.1, 'sine', 0.02, d);
    }
  },
  /** Change of Heart: a deck being riffled. */
  shuffle: () => {
    for (let i = 0; i < 18; i++) tick(0.08, 3000 + Math.random() * 3000, i * 0.025 + Math.random() * 0.01);
  },
  /** Momentum: a spin-up that keeps getting faster. */
  momentum: () => {
    let t = 0;
    for (let i = 0; i < 8; i++) {
      tone(300 + i * 90, 0.06, 'triangle', 0.04, t);
      t += 0.11 - i * 0.01;
    }
    tone(1100, 0.3, 'sine', 0.04, t, 1600);
  },
  /** Plan Ahead: target-lock beeps, then the lock tone. */
  lockOn: () => {
    [0, 0.16, 0.28, 0.37].forEach((d) => tone(1250, 0.05, 'square', 0.02, d));
    tone(1650, 0.35, 'square', 0.018, 0.46);
  },
  /** Sabotage: everyone else's systems powering down, with a glitch. */
  powerDown: () => {
    tone(700, 0.8, 'sawtooth', 0.035, 0, 60);
    noise(0.8, 0.04, { type: 'lowpass', from: 4000, to: 200 });
    [0.15, 0.22, 0.4].forEach((d) => tick(0.12, 900, d));
  },
  /** Show of Force: a klaxon while a target is chosen. */
  alarm: () => [0, 0.22, 0.44, 0.66].forEach((d, i) => tone(i % 2 ? 440 : 560, 0.2, 'square', 0.025, d)),
  /** Unveil the Fleet / Reorganisation: a deep swell as the fleet is recalled. */
  unveil: () => {
    tone(55, 1.2, 'sawtooth', 0.05, 0, 110, 0.6);
    noise(1.1, 0.08, { type: 'bandpass', from: 200, to: 2500, q: 1.5, rise: 0.8 });
    [220, 277, 330].forEach((f) => tone(f, 0.9, 'triangle', 0.03, 0.8));
  },
  /** Expansion: a launch horn as a new ship is built. */
  launch: () => {
    tone(196, 0.5, 'sawtooth', 0.03, 0, 392, 0.1);
    tone(294, 0.5, 'sawtooth', 0.025, 0.05, 588, 0.1);
  },

  win: () => fanfare(),
  error: () => tone(200, 0.15, 'sine', 0.05, 0, 150),
};

// ------------------------------------------------------------------ the victory show

let hallIn: AudioNode | null = null;

/** A big hall: a synthesized reverb tail the fanfare and fireworks send into, so they ring out. */
function hall(ac: AudioContext): AudioNode {
  if (!hallIn) {
    const len = Math.floor(ac.sampleRate * 3.2);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / ac.sampleRate;
        // A short gap, then a dense tail dying away over about three seconds.
        data[i] = t < 0.012 ? 0 : (Math.random() * 2 - 1) * Math.exp(-t / 0.75) * Math.min(1, t * 25);
      }
    }
    const conv = ac.createConvolver();
    conv.buffer = ir;
    const wet = ac.createGain();
    wet.gain.value = 0.55;
    conv.connect(wet).connect(out(ac));
    hallIn = conv;
  }
  return hallIn;
}

/** Plays `node` dry and sends `wet` of it into the hall. */
function send(ac: AudioContext, node: AudioNode, wet: number) {
  node.connect(out(ac));
  const g = ac.createGain();
  g.gain.value = wet;
  node.connect(g).connect(hall(ac));
}

/** A soft-clipping stage: a little grit and warmth, as a real horn section has. */
function warmth(ac: AudioContext, drive: number): WaveShaperNode {
  const shaper = ac.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
}

/**
 * One section note: `voices` players on detuned saws, each starting a hair apart and scooping up
 * into the pitch, through a filter that opens with the breath (`bright`) and closes as it's held.
 */
function horn(
  ac: AudioContext,
  dest: AudioNode,
  at: number,
  freq: number,
  dur: number,
  gain: number,
  { voices = 3, bright = 1, attack = 0.035 }: { voices?: number; bright?: number; attack?: number } = {},
) {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.9;
  const top = Math.min(16000, freq * (5 + 4 * bright));
  filter.frequency.setValueAtTime(freq * 1.4, at);
  filter.frequency.exponentialRampToValueAtTime(top, at + attack + 0.03);
  filter.frequency.exponentialRampToValueAtTime(Math.min(12000, freq * (2.6 + 1.8 * bright)), at + Math.min(dur, 0.5));
  const env = ac.createGain();
  const release = 0.18 + Math.min(dur, 1) * 0.25;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + attack);
  env.gain.exponentialRampToValueAtTime(gain * 0.75, at + attack + 0.12);
  if (dur > 0.6)
    env.gain.linearRampToValueAtTime(gain * 0.95, at + dur * 0.85); // held notes swell
  else env.gain.setValueAtTime(gain * 0.75, at + dur);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur + release);
  filter.connect(env).connect(dest);

  // Vibrato that creeps in on held notes.
  const lfo = ac.createOscillator();
  const depth = ac.createGain();
  lfo.frequency.value = jitter(5.2, 0.1);
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(dur > 0.4 ? freq * 0.007 : 0, at + Math.min(dur, 0.7));
  lfo.connect(depth);
  lfo.start(at);
  lfo.stop(at + dur + release + 0.05);

  for (let v = 0; v < voices; v++) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    const start = at + Math.random() * 0.014;
    osc.frequency.setValueAtTime(freq * 0.975, start);
    osc.frequency.exponentialRampToValueAtTime(freq, start + 0.05);
    osc.detune.value = (v - (voices - 1) / 2) * 7 + Math.random() * 4;
    depth.connect(osc.frequency);
    const vg = ac.createGain();
    vg.gain.value = 1 / Math.sqrt(voices);
    osc.connect(vg).connect(filter);
    osc.start(start);
    osc.stop(at + dur + release + 0.05);
  }
}

/** A slow-blooming string pad under the last chord. */
function strings(ac: AudioContext, dest: AudioNode, at: number, freqs: number[], dur: number, gain: number) {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.5);
  env.gain.setValueAtTime(gain, at + dur * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  filter.connect(env).connect(dest);
  for (const f of freqs)
    for (const d of [-9, 0, 9]) {
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = d + Math.random() * 3;
      osc.connect(filter);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    }
}

/** A timpani stroke: the drum's head (fundamental and the overtones a kettle drum has) sagging in pitch, and the mallet's thud. */
function kettle(ac: AudioContext, dest: AudioNode, at: number, freq: number, gain: number, ring = 1.4) {
  for (const [ratio, level, decay] of [
    [1, 1, ring],
    [1.5, 0.45, ring * 0.6],
    [1.98, 0.25, ring * 0.4],
    [2.44, 0.12, ring * 0.3],
  ]) {
    const osc = ac.createOscillator();
    osc.frequency.setValueAtTime(freq * ratio * 1.03, at);
    osc.frequency.exponentialRampToValueAtTime(freq * ratio, at + 0.08);
    const g = envelope(ac, at, decay, gain * level, 0.004);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
  const thud = ac.createBufferSource();
  thud.buffer = whiteNoise(ac);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  thud
    .connect(lp)
    .connect(envelope(ac, at, 0.12, gain * 0.5, 0.002))
    .connect(dest);
  thud.start(at, Math.random());
  thud.stop(at + 0.15);
}

/** A crash cymbal: inharmonic metal partials and bright noise ringing away. */
function crash(ac: AudioContext, dest: AudioNode, at: number, gain: number, dur = 3) {
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4200;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  env.gain.exponentialRampToValueAtTime(gain * 0.35, at + 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  hp.connect(env).connect(dest);
  for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f * 2.1;
    const g = ac.createGain();
    g.gain.value = 0.12;
    osc.connect(g).connect(hp);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
  const src = ac.createBufferSource();
  src.buffer = whiteNoise(ac);
  src.loop = true;
  src.connect(hp);
  src.start(at, Math.random());
  src.stop(at + dur + 0.05);
}

/** A cymbal played backwards: noise swelling up into a downbeat at `at + dur`. */
function swell(ac: AudioContext, dest: AudioNode, at: number, dur: number, gain: number) {
  const src = ac.createBufferSource();
  src.buffer = whiteNoise(ac);
  src.loop = true;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(7000, at);
  hp.frequency.exponentialRampToValueAtTime(2500, at + dur);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + dur);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.08);
  src.connect(hp).connect(env).connect(dest);
  src.start(at, Math.random());
  src.stop(at + dur + 0.1);
}

/** A glockenspiel note: a bright bar with its inharmonic overtone. */
function bell(ac: AudioContext, dest: AudioNode, at: number, freq: number, gain: number) {
  for (const [ratio, level, decay] of [
    [1, 1, 1.6],
    [2.76, 0.35, 0.6],
    [5.4, 0.12, 0.3],
  ]) {
    const osc = ac.createOscillator();
    osc.frequency.value = freq * ratio;
    osc.connect(envelope(ac, at, decay, gain * level, 0.002)).connect(dest);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

/** When the fanfare's big final chord lands, in seconds after it starts: the fireworks time their grand burst to it. */
export const FANFARE_HITS = { pickups: [0.75, 0.89, 1.03], first: 1.17, second: 1.9, rise: [2.45, 2.85], final: 3.25 };

/**
 * The victory fanfare: a timpani roll and cymbal swell, triplet pickups, a heroic climb through C, then
 * A-flat and B-flat major (♭VI–♭VII) into a huge C major chord with a crash, strings and bells, all in a hall.
 */
function fanfare() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.05;
  const H = FANFARE_HITS;

  const section = ac.createGain();
  section.gain.value = 0.9;
  const grit = warmth(ac, 1.6);
  section.connect(grit);
  send(ac, grit, 0.45);
  const perc = ac.createGain();
  perc.gain.value = 1;
  send(ac, perc, 0.35);

  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  // Notes by MIDI number: C4 = 60.
  const [C2, Ab2, Bb2, C3, G3, Ab3, Bb3, C4, D4, Eb4, E4, F4, G4, C5, E5, G5, Ab5, Bb5, C6] = [
    36, 44, 46, 48, 55, 56, 58, 60, 62, 63, 64, 65, 67, 72, 76, 79, 80, 82, 84,
  ].map(hz);
  const trumpet = (f: number, at: number, dur: number, g = 0.05) => horn(ac, section, t0 + at, f, dur, g, { voices: 3, bright: 1.1 });
  const hornsLow = (fs: number[], at: number, dur: number, g = 0.03) =>
    fs.forEach((f) => horn(ac, section, t0 + at, f, dur, g, { voices: 2, bright: 0.55, attack: 0.05 }));
  const bone = (f: number, at: number, dur: number, g = 0.05) =>
    horn(ac, section, t0 + at, f, dur, g, { voices: 2, bright: 0.7, attack: 0.04 });

  // The roll: soft to loud, and a reversed cymbal into the first note.
  for (let i = 0; i < 15; i++) kettle(ac, perc, t0 + i * 0.048, G3 / 2, 0.04 + i * 0.012, 0.5);
  swell(ac, perc, t0, H.pickups[0], 0.07);

  // Ta-ta-ta TAAA…
  for (const at of H.pickups) {
    trumpet(G4, at, 0.11);
    horn(ac, section, t0 + at, G3, 0.11, 0.025, { voices: 2, bright: 0.6 });
  }
  trumpet(C5, H.first, 0.6, 0.06);
  hornsLow([C4, E4, G4], H.first, 0.6);
  bone(C3, H.first, 0.6);
  kettle(ac, perc, t0 + H.first, C3, 0.28);

  // …ta TAAA…
  trumpet(E5, H.second - 0.15, 0.13);
  trumpet(G5, H.second, 0.5, 0.06);
  hornsLow([E4, G4, C5], H.second, 0.5);
  bone(C3, H.second, 0.5);
  kettle(ac, perc, t0 + H.second, G3 / 2, 0.26);

  // …climbing on A-flat and B-flat…
  const [rise1, rise2] = H.rise;
  trumpet(Ab5, rise1, 0.34, 0.06);
  hornsLow([Ab3, C4, Eb4], rise1, 0.34);
  bone(Ab2, rise1, 0.34);
  kettle(ac, perc, t0 + rise1, Ab2, 0.26);
  trumpet(Bb5, rise2, 0.34, 0.065);
  hornsLow([Bb3, D4, F4], rise2, 0.34);
  bone(Bb2, rise2, 0.34);
  kettle(ac, perc, t0 + rise2, Bb2, 0.28);
  swell(ac, perc, t0 + rise1, H.final - rise1, 0.05);

  // …and home on a huge C major.
  const F = H.final;
  const hold = 2.6;
  trumpet(C6, F, hold, 0.07);
  trumpet(G5, F, hold, 0.04);
  trumpet(E5, F, hold, 0.035);
  hornsLow([C4, E4, G4, C5], F, hold, 0.032);
  bone(C3, F, hold, 0.06);
  bone(C2, F, hold, 0.05);
  strings(ac, section, t0 + F, [C3, G3, C4, E4, G4], hold + 1.2, 0.02);
  kettle(ac, perc, t0 + F, C3, 0.34, 2);
  kettle(ac, perc, t0 + F, G3 / 2, 0.22, 2);
  crash(ac, perc, t0 + F, 0.09, 3.5);
  // A deep sub drop under the hit.
  const sub = ac.createOscillator();
  sub.frequency.setValueAtTime(70, t0 + F);
  sub.frequency.exponentialRampToValueAtTime(34, t0 + F + 1.6);
  sub.connect(envelope(ac, t0 + F, 1.8, 0.3, 0.006)).connect(perc);
  sub.start(t0 + F);
  sub.stop(t0 + F + 1.9);
  // A closing timpani flourish and bells sparkling up through the chord.
  [0, 0.12, 0.24].forEach((d, i) => kettle(ac, perc, t0 + F + hold - 0.5 + d, i === 2 ? C3 : G3 / 2, 0.14 + i * 0.05));
  [C6, E5 * 2, G5 * 2, C6 * 2, G5 * 2, C6 * 2].forEach((f, i) => bell(ac, perc, t0 + F + 0.15 + i * 0.11, f, 0.035));
}

/** Short bursts of crackle, made once: dense random snaps that flare then die away, like crackling microstars. */
let crackleBufs: { sampleRate: number; buffers: AudioBuffer[] } | null = null;
function crackleBuffers(ac: AudioContext): AudioBuffer[] {
  if (!crackleBufs || crackleBufs.sampleRate !== ac.sampleRate) {
    const sr = ac.sampleRate;
    const buffers = Array.from({ length: 4 }, () => {
      const len = Math.floor(sr * 1.6);
      const buf = ac.createBuffer(2, len, sr);
      const [left, right] = [buf.getChannelData(0), buf.getChannelData(1)];
      const snaps = 260 + Math.floor(Math.random() * 120);
      for (let k = 0; k < snaps; k++) {
        // Most snaps come early, thinning out towards the end; a few are much louder than the rest.
        const t = Math.random() ** 1.8 * 1.5;
        const start = Math.floor(t * sr);
        const amp = 0.15 + 0.85 * Math.random() ** 4;
        const decay = sr * (0.0004 + Math.random() * 0.0016);
        const pan = Math.random();
        for (let i = 0; i < decay * 6 && start + i < len; i++) {
          const v = (Math.random() * 2 - 1) * amp * Math.exp(-i / decay);
          left[start + i] += v * (1 - pan * 0.7);
          right[start + i] += v * (0.3 + pan * 0.7);
        }
      }
      return buf;
    });
    crackleBufs = { sampleRate: sr, buffers };
  }
  return crackleBufs.buffers;
}

/** Plays a crackle `delay` seconds from now. */
function crackle(ac: AudioContext, delay: number, gain: number) {
  const at = ac.currentTime + delay;
  const src = ac.createBufferSource();
  const buffers = crackleBuffers(ac);
  src.buffer = buffers[Math.floor(Math.random() * buffers.length)];
  src.playbackRate.value = jitter(1, 0.12);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 700;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = jitter(7000, 0.2);
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(hp).connect(lp).connect(g);
  send(ac, g, 0.25);
  src.start(at);
}

/** The victory show's sounds: the fanfare and the fireworks. */
export const show = {
  fanfare,
  /** A mortar firing: a muffled thump and the rocket's hiss (sometimes a whistle) as it climbs for `flight` seconds. */
  launch: (flight: number, level = 1) => {
    const ac = audio();
    if (!ac) return;
    const at = ac.currentTime;
    const dest = ac.createGain();
    dest.gain.value = level;
    send(ac, dest, 0.3);
    const thump = ac.createOscillator();
    thump.frequency.setValueAtTime(110, at);
    thump.frequency.exponentialRampToValueAtTime(45, at + 0.15);
    thump.connect(envelope(ac, at, 0.2, 0.12, 0.003)).connect(dest);
    thump.start(at);
    thump.stop(at + 0.25);
    const hiss = ac.createBufferSource();
    hiss.buffer = whiteNoise(ac);
    hiss.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(2000, at);
    bp.frequency.exponentialRampToValueAtTime(5000, at + flight);
    hiss
      .connect(bp)
      .connect(envelope(ac, at, flight, 0.03, flight * 0.4))
      .connect(dest);
    hiss.start(at, Math.random());
    hiss.stop(at + flight + 0.05);
    if (Math.random() < 0.3) {
      const whistle = ac.createOscillator();
      whistle.frequency.setValueAtTime(jitter(900), at + 0.05);
      whistle.frequency.exponentialRampToValueAtTime(jitter(2600), at + flight);
      whistle.connect(envelope(ac, at + 0.05, flight, 0.022, flight * 0.5)).connect(dest);
      whistle.start(at + 0.05);
      whistle.stop(at + flight + 0.1);
    }
  },
  /**
   * A shell bursting `distance` away (0 near to 1 far): the crack, a deep boom rolling round the hall, and with
   * `crackling` the snapping of microstars a moment later. Heard a little after it's seen, as from far off.
   */
  burst: (size = 1, { crackling = false, distance = Math.random(), level = 1 } = {}) => {
    const ac = audio();
    if (!ac) return;
    const delay = 0.03 + distance * 0.18;
    const at = ac.currentTime + delay;
    const g = level * size * (1 - distance * 0.45);
    const dest = ac.createGain();
    dest.gain.value = g;
    send(ac, dest, 0.5 + distance * 0.3);
    // The report: a hard, bright crack, duller from further away.
    const crack = ac.createBufferSource();
    crack.buffer = whiteNoise(ac);
    const crackLp = ac.createBiquadFilter();
    crackLp.type = 'lowpass';
    crackLp.frequency.value = 9000 - distance * 5000;
    crack
      .connect(crackLp)
      .connect(envelope(ac, at, 0.09, 0.5, 0.001))
      .connect(dest);
    crack.start(at, Math.random());
    crack.stop(at + 0.12);
    // The body: a boom that rumbles down.
    const body = ac.createBufferSource();
    body.buffer = whiteNoise(ac);
    body.loop = true;
    const bodyLp = ac.createBiquadFilter();
    bodyLp.type = 'lowpass';
    bodyLp.frequency.setValueAtTime(1100, at);
    bodyLp.frequency.exponentialRampToValueAtTime(90, at + 1.1);
    body
      .connect(bodyLp)
      .connect(envelope(ac, at, 1.3 * size, 0.42, 0.004))
      .connect(dest);
    body.start(at, Math.random());
    body.stop(at + 1.4 * size);
    const thump = ac.createOscillator();
    thump.frequency.setValueAtTime(jitter(80), at);
    thump.frequency.exponentialRampToValueAtTime(30, at + 0.6);
    thump.connect(envelope(ac, at, 0.7, 0.35, 0.003)).connect(dest);
    thump.start(at);
    thump.stop(at + 0.75);
    if (crackling) crackle(ac, delay + jitter(0.55, 0.2), 0.45 * level * (1 - distance * 0.4));
  },
  /** Crossette stars splitting: a handful of sharp pops. */
  pops: (level = 1) => {
    const ac = audio();
    if (!ac) return;
    const dest = ac.createGain();
    dest.gain.value = level;
    send(ac, dest, 0.4);
    for (let i = 0; i < 4; i++) {
      const at = ac.currentTime + 0.05 + Math.random() * 0.15;
      const src = ac.createBufferSource();
      src.buffer = whiteNoise(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = jitter(2200, 0.4);
      bp.Q.value = 0.8;
      src
        .connect(bp)
        .connect(envelope(ac, at, 0.05, 0.25, 0.001))
        .connect(dest);
      src.start(at, Math.random());
      src.stop(at + 0.07);
    }
  },
};
