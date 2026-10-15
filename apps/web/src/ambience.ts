// The music: a slow, soft drone of a few voices drifting from chord to chord, a faint wind
// of noise, and now and then a far-off chime, all in a long reverb. It plays from the lobby on while music
// is on and the page is visible (once the browser lets sound start, after the first tap or key), fading in and out.
//
// Everything it builds is let go when it stops: the sources stop, and once the fade is over every lasting
// node is disconnected, since the echo is a loop that would otherwise keep itself alive.

import { audio, contour, filter, gain, hz, isOn, noiseSource, onSwitch, oscillator, reverb } from './audio';
import { opening } from './openingSound';

const FADE_IN = 6;
const FADE_OUT = 2.5;
/** Longer than any game, in seconds: the drone's sources are stopped when it fades out. */
const FOREVER = 60 * 60 * 24;

const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// Open five-voice chords around D minor, as MIDI notes, low voice first. Each voice glides to its note in
// the next chord, a little after the one below it, so a change drifts in like a slow melody.
const CHORDS = [
  [38, 45, 53, 60, 64], // Dm9
  [34, 41, 50, 57, 60], // B♭maj9
  [31, 38, 46, 53, 57], // Gm9
  [36, 43, 52, 57, 62], // C6/9
  [33, 40, 48, 55, 62], // Am11
];

interface Drone {
  ac: AudioContext;
  bus: GainNode;
  /** Where chimes go: the echo, then the reverb. */
  chimes: AudioNode;
  voices: OscillatorNode[][];
  sources: AudioScheduledSourceNode[];
  /** The nodes that last as long as the drone, disconnected when it has faded out. */
  nodes: AudioNode[];
  timers: Set<number>;
  chord: number;
}

let wanted = 0;
let drone: Drone | null = null;
/** The lobby's title is showing on first opening: the drone waits for the opening (`holdForTitle`). */
let holding = false;
/** The music has begun since the page loaded: the opening is only for an app that opens on the lobby. */
let begun = false;

/** Starts the music, for as long as the app is open; returns the way to stop it (for a React effect). */
export function ambience(): () => void {
  wanted++;
  sync();
  return () => {
    wanted--;
    sync();
  };
}

function sync() {
  const play = wanted > 0 && !holding && isOn('music') && document.visibilityState === 'visible';
  if (play && !drone) {
    const ac = audio();
    if (ac) {
      drone = start(ac);
      begun = true;
    }
  } else if (!play && drone) {
    stop(drone);
    drone = null;
  }
}
onSwitch(sync);
document.addEventListener('visibilitychange', sync);
// In development a code change swaps this module for a new one: stop this one's drone, or it plays on.
import.meta.hot?.dispose(() => {
  wanted = 0;
  sync();
});

/**
 * The lobby's title is showing on the app's first screen: the drone waits, and when the title goes (rising into
 * the lobby) the opening plays and the drone comes in under its tail, so one flows into the other. If the music
 * has already begun (the app reopened on a game, then went to the lobby), it plays on and there is no opening.
 * Returns the way to say the title has gone.
 */
export function holdForTitle(): () => void {
  if (begun) return () => {};
  holding = true;
  sync();
  return () => {
    holding = false;
    // Where the browser doesn't yet let sound start (the title rose without a click), there is no opening, and
    // the drone comes in with the first click.
    const ac = isOn('music') ? audio() : null;
    const allowed = ac && (ac.state === 'running' || navigator.userActivation?.hasBeenActive);
    sync();
    if (!ac || !allowed) return;
    const land = opening(ac, ac.currentTime + 0.02);
    if (drone) fadeIn(drone, land + 2, 7);
  };
}

/** A slow sine wobbling `param` by `depth` around its value. */
function lfo(ac: AudioContext, d: Drone, param: AudioParam, rate: number, depth: number) {
  const osc = source(d, oscillator(ac, 'sine', rate, ac.currentTime, ac.currentTime + FOREVER));
  osc.connect(keep(d, gain(ac, depth))).connect(param);
}

/** `node`, to be disconnected when the drone has faded out. */
function keep<T extends AudioNode>(d: Drone, node: T): T {
  d.nodes.push(node);
  return node;
}

/** `node`, a source to stop when the drone fades out. */
function source<T extends AudioScheduledSourceNode>(d: Drone, node: T): T {
  d.sources.push(node);
  return keep(d, node);
}

function start(ac: AudioContext): Drone {
  const t = ac.currentTime;
  const bus = gain(ac, 0);
  const d: Drone = { ac, bus, chimes: bus, voices: [], sources: [], nodes: [bus], timers: new Set(), chord: 0 };
  fadeIn(d, t, FADE_IN);
  bus.connect(ac.destination);

  const verb = keep(d, reverb(ac));
  verb.connect(keep(d, gain(ac, 0.9))).connect(bus);
  const mix = keep(d, gain(ac, 1));
  mix.connect(keep(d, gain(ac, 0.45))).connect(bus);
  mix.connect(verb);

  // The chimes ring through a dark echo before the reverb.
  const echo = keep(d, ac.createDelay(2));
  echo.delayTime.value = 0.72;
  echo
    .connect(keep(d, filter(ac, 'lowpass', 1800)))
    .connect(keep(d, gain(ac, 0.42)))
    .connect(echo);
  echo.connect(mix);
  d.chimes = keep(d, gain(ac, 1));
  d.chimes.connect(mix);
  d.chimes.connect(echo);

  // The pad: pairs of detuned saws, darkened by a lowpass that slowly opens and closes.
  const pad = keep(d, filter(ac, 'lowpass', 620, 0.6));
  pad.connect(mix);
  lfo(ac, d, pad.frequency, 0.019, 260);
  const chord = CHORDS[0];
  chord.forEach((note, i) => {
    const level = keep(d, gain(ac, 0.02));
    // Each voice breathes at its own pace.
    lfo(ac, d, level.gain, between(0.03, 0.08), 0.012);
    const pan = keep(d, ac.createStereoPanner());
    pan.pan.value = ((i / (chord.length - 1)) * 2 - 1) * 0.55;
    level.connect(pan).connect(pad);
    const pair = [-6, 6].map((cents) => {
      const osc = source(d, oscillator(ac, 'sawtooth', hz(note), t, t + FOREVER));
      osc.detune.value = cents + between(-2, 2);
      osc.connect(level);
      return osc;
    });
    d.voices.push(pair);
  });

  // A faint wind: band-passed noise whose pitch wanders.
  const wind = source(d, noiseSource(ac, t, t + FOREVER));
  const band = keep(d, filter(ac, 'bandpass', 480, 0.7));
  lfo(ac, d, band.frequency, 0.013, 300);
  wind
    .connect(band)
    .connect(keep(d, gain(ac, 0.025)))
    .connect(mix);

  later(d, between(22, 32), () => changeChord(d));
  later(d, between(5, 9), () => chime(d));
  return d;
}

/** Runs `fn` in `seconds`, unless the drone stops first. */
function later(d: Drone, seconds: number, fn: () => void) {
  const id = window.setTimeout(() => {
    d.timers.delete(id);
    fn();
  }, seconds * 1000);
  d.timers.add(id);
}

function changeChord(d: Drone) {
  const { ac } = d;
  let next = Math.floor(Math.random() * (CHORDS.length - 1));
  if (next >= d.chord) next++;
  d.chord = next;
  CHORDS[next].forEach((note, i) => {
    const at = ac.currentTime + i * between(0.6, 1.4);
    for (const osc of d.voices[i]) osc.frequency.setTargetAtTime(hz(note), at, 2.2);
  });
  later(d, between(24, 36), () => changeChord(d));
}

/** One soft bell-like note high above the pad, from the chord it is on; sometimes a second follows. */
function chime(d: Drone, again = true) {
  const { ac } = d;
  const tones = CHORDS[d.chord].slice(1);
  let note = tones[Math.floor(Math.random() * tones.length)];
  while (note < 74) note += 12;
  const at = ac.currentTime + 0.05;
  const env = contour(ac, at, [
    [0.2, 0.03],
    [5, 0],
  ]);
  const pan = ac.createStereoPanner();
  pan.pan.value = between(-0.7, 0.7);
  env.connect(pan).connect(d.chimes);
  for (const [ratio, level] of [
    [1, 1],
    [2.003, 0.18],
  ]) {
    oscillator(ac, 'sine', hz(note) * ratio, at, at + 5.1)
      .connect(gain(ac, level))
      .connect(env);
  }
  if (again && Math.random() < 0.35) later(d, between(1.1, 1.8), () => chime(d, false));
  if (again) later(d, between(8, 16), () => chime(d));
}

/** Silent until `at`, then fading in over `seconds`. */
function fadeIn({ ac, bus }: Drone, at: number, seconds: number) {
  bus.gain.cancelScheduledValues(ac.currentTime);
  bus.gain.setValueAtTime(0, ac.currentTime);
  bus.gain.setValueAtTime(0, at);
  bus.gain.linearRampToValueAtTime(1, at + seconds);
}

function stop(d: Drone) {
  const { ac, bus } = d;
  d.timers.forEach(clearTimeout);
  d.timers.clear();
  const t = ac.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(0, t + FADE_OUT);
  for (const s of d.sources) s.stop(t + FADE_OUT + 0.1);
  window.setTimeout(() => d.nodes.forEach((n) => n.disconnect()), (FADE_OUT + 0.5) * 1000);
}
