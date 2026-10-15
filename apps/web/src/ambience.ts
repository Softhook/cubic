// The music: a slow, soft drone of a few voices drifting from chord to chord, a faint wind
// of noise, and now and then a far-off chime, all in a long reverb. It plays from the lobby on while music
// is on and the page is visible (once the browser lets sound start, after the first tap or key), fading in and out.
//
// Everything it builds is let go when it stops: the sources stop, and once the fade is over every lasting
// node is disconnected, since the echo is a loop that would otherwise keep itself alive. The reverb is shared
// with the opening, and kept (audio.ts).

import { audio, contour, filter, gain, hz, isOn, noiseSource, onSwitch, oscillator, panner, reverb, spread } from './audio';
import { opening } from './openingSound';
import { pick, rand } from './random';

const FADE_IN = 6;
const FADE_OUT = 2.5;
/** Longer than any game, in seconds: the drone's sources are stopped when it fades out. */
const FOREVER = 60 * 60 * 24;

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
    // Hidden, the audio is suspended at once (audio.ts): a fade would only be heard on return, over the new drone.
    stop(drone, document.visibilityState === 'hidden' ? 0 : FADE_OUT);
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
 * The lobby's title is showing on the app's first screen: the drone waits. `open` plays the opening, as the title
 * is about to rise, and resolves when it is heard, so the title rises with its rush; the drone then comes in under
 * its tail, so one flows into the other. Where the browser doesn't yet let sound start (no click yet), there is no
 * opening: `open` resolves at once, and the drone comes in with the first click. If the music has already begun
 * (the app reopened on a game, then went to the lobby), it plays on and there is no opening. `release` says the
 * title has gone.
 */
export function holdForTitle(): { open: () => Promise<void>; release: () => void } {
  if (begun) return { open: () => Promise.resolve(), release: () => {} };
  holding = true;
  sync();
  let opened: Promise<void> | null = null;
  return {
    open: () => (opened ??= playOpening()),
    release: () => {
      if (!opened) letGo();
    },
  };
}

function letGo() {
  holding = false;
  sync();
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function playOpening() {
  const ac = isOn('music') ? audio() : null;
  if (!ac || !(ac.state === 'running' || navigator.userActivation?.hasBeenActive)) return letGo();
  // The audio may only just be starting (a phone takes a moment): the opening's times only run once it has.
  await Promise.race([ac.resume().catch(() => undefined), wait(500)]);
  if (ac.state !== 'running') return letGo();
  const { start, land } = opening(ac);
  // The drone is built once the chord has bloomed, not with the opening: on a phone, building and playing
  // both at once makes the opening stutter.
  window.setTimeout(
    () => {
      letGo();
      if (drone) fadeIn(drone, ac.currentTime + 1, 7);
    },
    (land + 1 - ac.currentTime) * 1000,
  );
  // Until it comes out of the speaker, which on a phone is a good while after it is played.
  await wait((start - ac.currentTime + ac.baseLatency + (ac.outputLatency || 0)) * 1000);
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
  // The drone fades in and out on its way into the reverb, which rings on as it fades out.
  const bus = gain(ac, 0);
  const d: Drone = { ac, bus, chimes: bus, voices: [], sources: [], nodes: [bus], timers: new Set(), chord: 0 };
  fadeIn(d, t, FADE_IN);
  bus.connect(keep(d, gain(ac, 0.45))).connect(ac.destination);
  bus.connect(reverb(ac));

  // The chimes ring through a dark echo before the reverb.
  const echo = keep(d, ac.createDelay(2));
  echo.delayTime.value = 0.72;
  echo
    .connect(keep(d, filter(ac, 'lowpass', 1800)))
    .connect(keep(d, gain(ac, 0.42)))
    .connect(echo);
  echo.connect(bus);
  d.chimes = keep(d, gain(ac, 1));
  d.chimes.connect(bus);
  d.chimes.connect(echo);

  // The pad: pairs of detuned saws, darkened by a lowpass that slowly opens and closes.
  const pad = keep(d, filter(ac, 'lowpass', 620, 0.6));
  pad.connect(bus);
  lfo(ac, d, pad.frequency, 0.019, 260);
  const chord = CHORDS[0];
  chord.forEach((note, i) => {
    const level = keep(d, gain(ac, 0.02));
    // Each voice breathes at its own pace.
    lfo(ac, d, level.gain, rand(0.03, 0.08), 0.012);
    level.connect(keep(d, panner(ac, spread(i, chord.length, 0.55)))).connect(pad);
    const pair = [-6, 6].map((cents) => {
      const osc = source(d, oscillator(ac, 'sawtooth', hz(note), t, t + FOREVER));
      osc.detune.value = cents + rand(-2, 2);
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
    .connect(bus);

  later(d, rand(22, 32), () => changeChord(d));
  later(d, rand(5, 9), () => chime(d));
  return d;
}

/**
 * Runs `fn` in `seconds`, unless the drone stops first. While the audio is suspended (a phone's app losing focus,
 * audio.ts) it waits again: its time stands still, and chimes played then would all ring out at once on return.
 */
function later(d: Drone, seconds: number, fn: () => void) {
  const id = window.setTimeout(() => {
    d.timers.delete(id);
    if (d.ac.state === 'running') fn();
    else later(d, seconds, fn);
  }, seconds * 1000);
  d.timers.add(id);
}

function changeChord(d: Drone) {
  const { ac } = d;
  let next = Math.floor(Math.random() * (CHORDS.length - 1));
  if (next >= d.chord) next++;
  d.chord = next;
  CHORDS[next].forEach((note, i) => {
    const at = ac.currentTime + i * rand(0.6, 1.4);
    for (const osc of d.voices[i]) osc.frequency.setTargetAtTime(hz(note), at, 2.2);
  });
  later(d, rand(24, 36), () => changeChord(d));
}

/** One soft bell-like note high above the pad, from the chord it is on; sometimes a second follows. */
function chime(d: Drone, again = true) {
  const { ac } = d;
  const tones = CHORDS[d.chord].slice(1);
  let note = pick(tones);
  while (note < 74) note += 12;
  const at = ac.currentTime + 0.05;
  const env = contour(ac, at, [
    [0.2, 0.03],
    [5, 0],
  ]);
  env.connect(panner(ac, rand(-0.7, 0.7))).connect(d.chimes);
  for (const [ratio, level] of [
    [1, 1],
    [2.003, 0.18],
  ]) {
    oscillator(ac, 'sine', hz(note) * ratio, at, at + 5.1)
      .connect(gain(ac, level))
      .connect(env);
  }
  if (again && Math.random() < 0.35) later(d, rand(1.1, 1.8), () => chime(d, false));
  if (again) later(d, rand(8, 16), () => chime(d));
}

/** Silent until `at`, then fading in over `seconds`. */
function fadeIn({ ac, bus }: Drone, at: number, seconds: number) {
  bus.gain.cancelScheduledValues(ac.currentTime);
  bus.gain.setValueAtTime(0, ac.currentTime);
  bus.gain.setValueAtTime(0, at);
  bus.gain.linearRampToValueAtTime(1, at + seconds);
}

function stop(d: Drone, fade: number) {
  const { ac, bus } = d;
  d.timers.forEach(clearTimeout);
  d.timers.clear();
  const t = ac.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(0, t + fade);
  for (const s of d.sources) s.stop(t + fade + 0.1);
  window.setTimeout(() => d.nodes.forEach((n) => n.disconnect()), (fade + 0.5) * 1000);
}
