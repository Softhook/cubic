// The victory show's sounds: a brass fanfare and the fireworks (components/fireworks/), all played in a hall.

import { audio, contour, envelope, filter, gain, glide, jitter, noiseSource, oscillator, out } from './audio';

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
    conv.connect(gain(ac, 0.55)).connect(out(ac));
    hallIn = conv;
  }
  return hallIn;
}

/** Plays `node` straight out and sends `wet` of it into the hall. */
function send<T extends AudioNode>(ac: AudioContext, node: T, wet: number): T {
  node.connect(out(ac));
  node.connect(gain(ac, wet)).connect(hall(ac));
  return node;
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

/** Partials as [frequency ratio, level, decay seconds], each a sine dying away: drums and bells. */
function partials(ac: AudioContext, dest: AudioNode, at: number, freq: number, level: number, parts: number[][], sag = 1) {
  for (const [ratio, part, decay] of parts) {
    const osc = oscillator(ac, 'sine', freq * ratio * sag, at, at + decay + 0.05);
    if (sag !== 1) osc.frequency.exponentialRampToValueAtTime(freq * ratio, at + 0.08);
    osc.connect(envelope(ac, at, decay, level * part, 0.003)).connect(dest);
  }
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
  level: number,
  { voices = 3, bright = 1, attack = 0.035 }: { voices?: number; bright?: number; attack?: number } = {},
) {
  const release = 0.18 + Math.min(dur, 1) * 0.25;
  const end = at + dur + release + 0.05;
  const lp = filter(ac, 'lowpass', freq * 1.4, 0.9);
  glide(lp.frequency, at, freq * 1.4, [
    [attack + 0.03, Math.min(16000, freq * (5 + 4 * bright))],
    [Math.min(dur, 0.5), Math.min(12000, freq * (2.6 + 1.8 * bright))],
  ]);
  // Blown, eased off, held (long notes swelling a little), released.
  const held = dur > 0.6 ? 0.95 : 0.75;
  const env = contour(ac, at, [
    [attack, level],
    [attack + 0.12, level * 0.75],
    [Math.max(attack + 0.13, dur * 0.85), level * held],
    [dur + release, 0],
  ]);
  lp.connect(env).connect(dest);

  // Vibrato that creeps in on held notes.
  const depth = ac.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(dur > 0.4 ? freq * 0.007 : 0, at + Math.min(dur, 0.7));
  oscillator(ac, 'sine', jitter(5.2, 0.1), at, end).connect(depth);

  for (let v = 0; v < voices; v++) {
    const start = at + Math.random() * 0.014;
    const osc = oscillator(ac, 'sawtooth', freq * 0.975, start, end);
    osc.frequency.exponentialRampToValueAtTime(freq, start + 0.05);
    osc.detune.value = (v - (voices - 1) / 2) * 7 + Math.random() * 4;
    depth.connect(osc.frequency);
    osc.connect(gain(ac, 1 / Math.sqrt(voices))).connect(lp);
  }
}

/** A slow-blooming string pad. */
function strings(ac: AudioContext, dest: AudioNode, at: number, freqs: number[], dur: number, level: number) {
  const lp = filter(ac, 'lowpass', 2400);
  const env = contour(ac, at, [
    [0.5, level],
    [dur * 0.7, level],
    [dur, 0],
  ]);
  lp.connect(env).connect(dest);
  for (const f of freqs)
    for (const d of [-9, 0, 9]) {
      const osc = oscillator(ac, 'sawtooth', f, at, at + dur + 0.05);
      osc.detune.value = d + Math.random() * 3;
      osc.connect(lp);
    }
}

/** A timpani stroke: the drum's head (fundamental and the overtones a kettle drum has) sagging in pitch, and the mallet's thud. */
function kettle(ac: AudioContext, dest: AudioNode, at: number, freq: number, level: number, ring = 1.4) {
  const head = [
    [1, 1, ring],
    [1.5, 0.45, ring * 0.6],
    [1.98, 0.25, ring * 0.4],
    [2.44, 0.12, ring * 0.3],
  ];
  partials(ac, dest, at, freq, level, head, 1.03);
  noiseSource(ac, at, at + 0.15)
    .connect(filter(ac, 'lowpass', 500))
    .connect(envelope(ac, at, 0.12, level * 0.5, 0.002))
    .connect(dest);
}

/** A glockenspiel note: a bright bar with its inharmonic overtones. */
function bell(ac: AudioContext, dest: AudioNode, at: number, freq: number, level: number) {
  partials(ac, dest, at, freq, level, [
    [1, 1, 1.6],
    [2.76, 0.35, 0.6],
    [5.4, 0.12, 0.3],
  ]);
}

/** A crash cymbal: inharmonic metal partials and bright noise ringing away. */
function crash(ac: AudioContext, dest: AudioNode, at: number, level: number, dur = 3) {
  const end = at + dur + 0.05;
  const hp = filter(ac, 'highpass', 4200);
  const env = contour(ac, at, [
    [0.004, level],
    [0.25, level * 0.35],
    [dur, 0],
  ]);
  hp.connect(env).connect(dest);
  for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800])
    oscillator(ac, 'square', f * 2.1, at, end)
      .connect(gain(ac, 0.12))
      .connect(hp);
  noiseSource(ac, at, end).connect(hp);
}

/** A cymbal played backwards: noise swelling up into a downbeat at `at + dur`. */
function swell(ac: AudioContext, dest: AudioNode, at: number, dur: number, level: number) {
  const hp = filter(ac, 'highpass', 7000);
  glide(hp.frequency, at, 7000, [[dur, 2500]]);
  noiseSource(ac, at, at + dur + 0.1)
    .connect(hp)
    .connect(envelope(ac, at, dur + 0.08, level, dur))
    .connect(dest);
}

/** When the fanfare's notes land, in seconds after it starts: the fireworks burst in time with them. */
export const FANFARE_HITS = { pickups: [0.75, 0.89, 1.03], first: 1.17, second: 1.9, rise: [2.45, 2.85], final: 3.25 };

/**
 * The victory fanfare: a timpani roll and cymbal swell, triplet pickups, a heroic climb through C, then
 * A-flat and B-flat major (♭VI–♭VII) into a huge C major chord with a crash, strings and bells.
 */
export function fanfare() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.05;
  const H = FANFARE_HITS;

  const grit = warmth(ac, 1.6);
  const section = gain(ac, 0.9);
  section.connect(grit);
  send(ac, grit, 0.45);
  const perc = send(ac, gain(ac, 1), 0.35);

  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  // Notes by MIDI number: C4 = 60.
  const [C2, G2, Ab2, Bb2, C3, G3, Ab3, Bb3, C4, D4, Eb4, E4, F4, G4, C5, E5, G5, Ab5, Bb5, C6] = [
    36, 43, 44, 46, 48, 55, 56, 58, 60, 62, 63, 64, 65, 67, 72, 76, 79, 80, 82, 84,
  ].map(hz);
  const trumpet = (f: number, at: number, dur: number, g = 0.05) => horn(ac, section, t0 + at, f, dur, g, { voices: 3, bright: 1.1 });
  const horns = (fs: number[], at: number, dur: number, g = 0.03) =>
    fs.forEach((f) => horn(ac, section, t0 + at, f, dur, g, { voices: 2, bright: 0.55, attack: 0.05 }));
  const trombone = (f: number, at: number, dur: number, g = 0.05) =>
    horn(ac, section, t0 + at, f, dur, g, { voices: 2, bright: 0.7, attack: 0.04 });
  const timpani = (f: number, at: number, g: number, ring?: number) => kettle(ac, perc, t0 + at, f, g, ring);
  /** One chord of the climb: trumpet on top, horns and a trombone under it, and a drum stroke. */
  const hit = (at: number, dur: number, top: number, chord: number[], bass: number, drum: number, g = 0.06) => {
    trumpet(top, at, dur, g);
    horns(chord, at, dur);
    trombone(bass, at, dur);
    timpani(drum, at, 0.27);
  };

  // The roll: soft to loud, and a reversed cymbal into the first note.
  for (let i = 0; i < 15; i++) timpani(G2, i * 0.048, 0.04 + i * 0.012, 0.5);
  swell(ac, perc, t0, H.pickups[0], 0.07);

  // Ta-ta-ta TAAA, ta TAAA…
  for (const at of H.pickups) {
    trumpet(G4, at, 0.11);
    horn(ac, section, t0 + at, G3, 0.11, 0.025, { voices: 2, bright: 0.6 });
  }
  hit(H.first, 0.6, C5, [C4, E4, G4], C3, C3);
  trumpet(E5, H.second - 0.15, 0.13);
  hit(H.second, 0.5, G5, [E4, G4, C5], C3, G2);

  // …climbing on A-flat and B-flat…
  const [rise1, rise2] = H.rise;
  hit(rise1, 0.34, Ab5, [Ab3, C4, Eb4], Ab2, Ab2);
  hit(rise2, 0.34, Bb5, [Bb3, D4, F4], Bb2, Bb2, 0.065);
  swell(ac, perc, t0 + rise1, H.final - rise1, 0.05);

  // …and home on a huge C major.
  const F = H.final;
  const hold = 2.6;
  trumpet(C6, F, hold, 0.07);
  trumpet(G5, F, hold, 0.04);
  trumpet(E5, F, hold, 0.035);
  horns([C4, E4, G4, C5], F, hold, 0.032);
  trombone(C3, F, hold, 0.06);
  trombone(C2, F, hold, 0.05);
  strings(ac, section, t0 + F, [C3, G3, C4, E4, G4], hold + 1.2, 0.02);
  timpani(C3, F, 0.34, 2);
  timpani(G2, F, 0.22, 2);
  crash(ac, perc, t0 + F, 0.09, 3.5);
  // A deep sub drop under the hit.
  const sub = oscillator(ac, 'sine', 70, t0 + F, t0 + F + 1.9);
  sub.frequency.exponentialRampToValueAtTime(34, t0 + F + 1.6);
  sub.connect(envelope(ac, t0 + F, 1.8, 0.3, 0.006)).connect(perc);
  // A closing timpani flourish, and bells sparkling up through the chord.
  [G2, G2, C3].forEach((f, i) => timpani(f, F + hold - 0.5 + i * 0.12, 0.14 + i * 0.05));
  [C6, E5 * 2, G5 * 2, C6 * 2, G5 * 2, C6 * 2].forEach((f, i) => bell(ac, perc, t0 + F + 0.15 + i * 0.11, f, 0.035));
}

let crackleBufs: { sampleRate: number; buffers: AudioBuffer[] } | null = null;

/** Short bursts of crackle, made once: dense random snaps that flare then die away, like crackling microstars. */
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
        const start = Math.floor(Math.random() ** 1.8 * 1.5 * sr);
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

/** A crackle at `at`. */
function crackle(ac: AudioContext, at: number, level: number) {
  const src = ac.createBufferSource();
  const buffers = crackleBuffers(ac);
  src.buffer = buffers[Math.floor(Math.random() * buffers.length)];
  src.playbackRate.value = jitter(1, 0.12);
  src
    .connect(filter(ac, 'highpass', 700))
    .connect(filter(ac, 'lowpass', jitter(7000, 0.2)))
    .connect(send(ac, gain(ac, level), 0.25));
  src.start(at);
}

/** The fireworks' sounds. `level` turns each down (under the fanfare). */
export const fireworkSound = {
  /** A mortar firing: a muffled thump and the rocket's hiss (sometimes a whistle) as it climbs for `flight` seconds. */
  launch: (flight: number, level = 1) => {
    const ac = audio();
    if (!ac) return;
    const at = ac.currentTime;
    const dest = send(ac, gain(ac, level), 0.3);
    const thump = oscillator(ac, 'sine', 110, at, at + 0.25);
    thump.frequency.exponentialRampToValueAtTime(45, at + 0.15);
    thump.connect(envelope(ac, at, 0.2, 0.12, 0.003)).connect(dest);
    const bp = filter(ac, 'bandpass', 2000, 1.5);
    glide(bp.frequency, at, 2000, [[flight, 5000]]);
    noiseSource(ac, at, at + flight + 0.05)
      .connect(bp)
      .connect(envelope(ac, at, flight, 0.03, flight * 0.4))
      .connect(dest);
    if (Math.random() < 0.3) {
      const whistle = oscillator(ac, 'sine', jitter(900), at + 0.05, at + flight + 0.1);
      whistle.frequency.exponentialRampToValueAtTime(jitter(2600), at + flight);
      whistle.connect(envelope(ac, at + 0.05, flight, 0.022, flight * 0.5)).connect(dest);
    }
  },
  /**
   * A shell bursting `distance` away (0 near to 1 far): the crack, a deep boom rolling round the hall, and with
   * `crackling` the snapping of microstars a moment later. Heard a little after it's seen, as from far off.
   */
  burst: (size = 1, { crackling = false, distance = Math.random(), level = 1 } = {}) => {
    const ac = audio();
    if (!ac) return;
    const at = ac.currentTime + 0.03 + distance * 0.18;
    const dest = send(ac, gain(ac, level * size * (1 - distance * 0.45)), 0.5 + distance * 0.3);
    // The report: a hard, bright crack, duller from further away.
    noiseSource(ac, at, at + 0.12)
      .connect(filter(ac, 'lowpass', 9000 - distance * 5000))
      .connect(envelope(ac, at, 0.09, 0.5, 0.001))
      .connect(dest);
    // The body: a boom that rumbles down.
    const lp = filter(ac, 'lowpass', 1100);
    glide(lp.frequency, at, 1100, [[1.1, 90]]);
    noiseSource(ac, at, at + 1.4 * size)
      .connect(lp)
      .connect(envelope(ac, at, 1.3 * size, 0.42, 0.004))
      .connect(dest);
    const thump = oscillator(ac, 'sine', jitter(80), at, at + 0.75);
    thump.frequency.exponentialRampToValueAtTime(30, at + 0.6);
    thump.connect(envelope(ac, at, 0.7, 0.35, 0.003)).connect(dest);
    if (crackling) crackle(ac, at + jitter(0.55, 0.2), 0.45 * level * (1 - distance * 0.4));
  },
  /** Crossette stars splitting: a handful of sharp pops. */
  pops: (level = 1) => {
    const ac = audio();
    if (!ac) return;
    const dest = send(ac, gain(ac, level), 0.4);
    for (let i = 0; i < 4; i++) {
      const at = ac.currentTime + 0.05 + Math.random() * 0.15;
      noiseSource(ac, at, at + 0.07)
        .connect(filter(ac, 'bandpass', jitter(2200, 0.4), 0.8))
        .connect(envelope(ac, at, 0.05, 0.25, 0.001))
        .connect(dest);
    }
  },
};
