// Tiny synthesized sound kit (no audio files). All sounds are short and quiet.

let ctx: AudioContext | null = null;
let enabled = true;

try {
  enabled = localStorage.getItem('quantum.sound') !== 'off';
} catch {
  /* storage unavailable */
}

export function soundEnabled() {
  return enabled;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem('quantum.sound', on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
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
  src.connect(filter).connect(g).connect(ac.destination);
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

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number) {
  const ac = audio();
  if (!ac) return;
  const at = ac.currentTime + delay;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

export const sfx = {
  select: () => tone(880, 0.07, 'sine', 0.05),
  move: () => tone(420, 0.16, 'sine', 0.05, 0, 620),
  hit: () => {
    tone(140, 0.35, 'triangle', 0.18, 0, 50);
    tone(90, 0.25, 'sine', 0.12, 0.02);
  },
  repel: () => tone(300, 0.2, 'square', 0.03, 0, 180),
  missile: () => tone(1400, 0.4, 'sawtooth', 0.03, 0, 200),
  cube: () => {
    tone(660, 0.18, 'sine', 0.07);
    tone(990, 0.3, 'sine', 0.06, 0.09);
  },
  card: () => tone(520, 0.12, 'triangle', 0.05, 0, 700),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'sine', 0.08, i * 0.13)),
  error: () => tone(200, 0.15, 'sine', 0.05, 0, 150),
};
