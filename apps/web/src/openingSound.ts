// The app's opening, as the lobby's title rises on first opening: a deep hit, a rush climbing with the title,
// and as it lands a wide D minor chord blooming open with high chimes over it, all in a long reverb. It is the
// drone's first chord (ambience.ts), so the one rings on into the other.

import { contour, filter, gain, glide, hz, noiseSource, oscillator, reverb } from './audio';

/** Seconds from the start to the title landing: its rise (components/Lobby.tsx) takes about one, settling gently. */
const LAND = 0.8;
/** Seconds the chord rings after the landing. */
const RING = 8;
/** D minor, from a low D up through A, D, F, A, C, E to a high A, as MIDI notes. */
const CHORD = [26, 38, 45, 50, 53, 57, 60, 64, 69];
/** D, A and E high above it. */
const CHIMES = [74, 81, 88];

/** Plays the opening from `at`; returns when the title lands and the chord blooms. */
export function opening(ac: AudioContext, at: number): number {
  const land = at + LAND;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 4;
  comp.connect(ac.destination);
  const verb = reverb(ac);
  verb.connect(gain(ac, 0.9)).connect(comp);
  const mix = gain(ac, 0.8);
  mix.connect(comp);
  mix.connect(verb);

  thud(ac, mix, at);
  rush(ac, mix, at);
  bloom(ac, mix, land);
  chimes(ac, mix, verb, land);

  // Once the reverb has rung out, nothing is left playing.
  window.setTimeout(() => comp.disconnect(), (land + RING + 6.5 - ac.currentTime) * 1000);
  return land;
}

/** A deep thud falling in pitch. */
function thud(ac: AudioContext, dest: AudioNode, at: number) {
  const osc = oscillator(ac, 'sine', 72, at, at + 2.6);
  osc.frequency.exponentialRampToValueAtTime(34, at + 1.4);
  osc
    .connect(
      contour(ac, at, [
        [0.012, 0.55],
        [2.4, 0],
      ]),
    )
    .connect(dest);
}

/** Noise swept up with the title, swelling into its landing. */
function rush(ac: AudioContext, dest: AudioNode, at: number) {
  const band = filter(ac, 'bandpass', 160, 1.4);
  glide(band.frequency, at, 160, [
    [LAND, 3200],
    [LAND * 2, 7000],
  ]);
  noiseSource(ac, at, at + LAND * 2 + 0.1)
    .connect(band)
    .connect(
      contour(ac, at, [
        [LAND * 0.9, 0.22],
        [LAND * 2, 0],
      ]),
    )
    .connect(dest);
}

/** The chord: detuned saws spread across the stereo field, their lowpass opening wide at `land` and slowly closing as they fade. */
function bloom(ac: AudioContext, dest: AudioNode, land: number) {
  const from = land - 0.15;
  const open = filter(ac, 'lowpass', 280, 0.9);
  glide(open.frequency, land, 280, [
    [0.5, 3400],
    [RING - 1, 420],
  ]);
  open
    .connect(
      contour(ac, from, [
        [0.25, 1],
        [2, 0.55],
        [RING, 0],
      ]),
    )
    .connect(dest);
  CHORD.forEach((note, i) => {
    const pan = ac.createStereoPanner();
    pan.pan.value = ((i / (CHORD.length - 1)) * 2 - 1) * 0.7;
    pan.connect(open);
    for (const cents of [-9, 9]) {
      const osc = oscillator(ac, 'sawtooth', hz(note), from, land + RING);
      osc.detune.value = cents;
      // The low D carries the weight.
      osc.connect(gain(ac, i === 0 ? 0.05 : 0.028)).connect(pan);
    }
  });
}

/** The chimes rising one after another as the chord blooms, mostly heard in the reverb. */
function chimes(ac: AudioContext, dest: AudioNode, verb: AudioNode, land: number) {
  CHIMES.forEach((note, i) => {
    const at = land + 0.05 + i * 0.14;
    const env = contour(ac, at, [
      [0.01, 0.05],
      [4, 0],
    ]);
    oscillator(ac, 'sine', hz(note), at, at + 4.1).connect(env);
    env.connect(gain(ac, 0.4)).connect(dest);
    env.connect(verb);
  });
}
