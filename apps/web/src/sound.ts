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

/** Two seconds of white noise, made once and reused by every noise sound. */
function whiteNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function click(ac: AudioContext, at: number, gain: number, freq: number) {
  const len = 0.035;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 2.5;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(out(ac));
  src.start(at);
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
  { delay = 0, type = 'bandpass', from = 1000, to = from, q = 1, rise = 0.01 }: {
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
  src.connect(filter).connect(envelope(ac, at, dur, gain, rise)).connect(out(ac));
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
  hit: () => {
    tone(140, 0.35, 'triangle', 0.18, 0, 50);
    tone(90, 0.25, 'sine', 0.12, 0.02);
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
    const ac = audio();
    if (!ac) return;
    for (let i = 0; i < 18; i++) click(ac, ac.currentTime + i * 0.025 + Math.random() * 0.01, 0.08, 3000 + Math.random() * 3000);
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
    const ac = audio();
    if (ac) [0.15, 0.22, 0.4].forEach((d) => click(ac, ac.currentTime + d, 0.12, 900));
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

  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'sine', 0.08, i * 0.13)),
  error: () => tone(200, 0.15, 'sine', 0.05, 0, 150),
};
