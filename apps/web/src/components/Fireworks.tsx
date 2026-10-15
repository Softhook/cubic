import { useEffect, useRef } from 'react';
import { NEBULA_HUES } from '@quantum/art';
import { reducedMotion } from '../game/useMediaQuery';
import { FANFARE_HITS, show } from '../sound';

// The victory show. Rockets climb from the bottom of the screen and burst, in time with the fanfare, into
// peonies, brocades, rings, ringed planets, spiral galaxies, golden willows, crossettes that split again
// and, on the fanfare's last chord, a supernova. Every burst lights the sky, sends out a shock wave and leaves
// its smoke glowing as a nebula, swirled like the nebulae in the board art, that drifts and fades.
// Two canvases behind the game-over popup: the glow (redrawn each frame) under the sparks (which leave
// trails). Nothing at all under reduced motion.

type Rgb = [number, number, number];

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds left, and seconds it started with. */
  life: number;
  max: number;
  rgb: Rgb;
  size: number;
  drag: number;
  gravity: number;
  /** Twinkles as it fades. */
  glitter: boolean;
  /** Splits into a small star of its own when it burns out. */
  split: boolean;
  /** Sheds golden embers as it flies (brocade and willow). */
  tail: boolean;
}

type Shape = 'peony' | 'brocade' | 'double' | 'ring' | 'planet' | 'galaxy' | 'willow' | 'crossette' | 'supernova';
const SHAPES: Shape[] = ['peony', 'brocade', 'double', 'ring', 'planet', 'galaxy', 'galaxy', 'willow', 'crossette'];

interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Its own deceleration, so it reaches its peak in exactly the flight time asked for. */
  g: number;
  /** Seconds until it bursts. */
  t: number;
  shape: Shape;
  rgb: Rgb;
  /** A second colour some shapes mix in. */
  alt: Rgb;
  scale: number;
  /** How loud it is (quieter under the fanfare). */
  level: number;
}

/** A puff of glowing smoke: one nebula sprite, growing, turning and fading. */
interface Cloud {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r0: number;
  r1: number;
  rot: number;
  spin: number;
  life: number;
  max: number;
  peak: number;
  img: HTMLCanvasElement;
}

/** The sky lit up by a burst, or the shock wave racing out from it. */
interface Light {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  rgb: Rgb;
}

interface LaunchOptions {
  shape?: Shape;
  scale?: number;
  /** Seconds from launch to burst. */
  flight?: number;
  /** Where it bursts, as fractions of the screen. */
  x?: number;
  y?: number;
  rgb?: Rgb;
}

const GOLD: Rgb = [255, 200, 100];
const WHITE: Rgb = [235, 242, 255];
const GRAVITY = 140;
const SPRITE = 128;
const SPRITES = 4;

/** Any CSS colour as RGB, by letting the canvas parse it. */
function toRgb(ctx: CanvasRenderingContext2D, color: string): Rgb {
  ctx.fillStyle = '#ffffff';
  ctx.fillStyle = color;
  const hex = ctx.fillStyle;
  if (hex.startsWith('#') && hex.length === 7) return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  return GOLD;
}

/** A brighter, paler version of `c`, so dark player colours still glow. */
const lift = (c: Rgb, by = 0.35): Rgb => c.map((v) => Math.round(v + (255 - v) * by)) as Rgb;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`;

/** Smooth 2-D value noise on a wrapping 64 × 64 grid. */
function valueNoise(seed: number) {
  const N = 64;
  let s = seed >>> 0;
  const grid = Float32Array.from({ length: N * N }, () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const at = (i: number, j: number) => grid[(j & (N - 1)) * N + (i & (N - 1))];
  return (x: number, y: number) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = at(i, j);
    const b = at(i + 1, j);
    const c = at(i, j + 1);
    const d = at(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/**
 * A white nebula cloud on transparent, as the board art draws them: fractal noise swirled by a second
 * noise, with fine bright filaments, fading out raggedly towards its edge.
 */
function nebulaSprite(seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(SPRITE, SPRITE);
  const cloud = valueNoise(seed);
  const warp = valueNoise(seed + 101);
  const ridge = valueNoise(seed + 202);
  for (let y = 0; y < SPRITE; y++)
    for (let x = 0; x < SPRITE; x++) {
      const u = (x / SPRITE) * 2 - 1;
      const v = (y / SPRITE) * 2 - 1;
      const wx = fbm(warp, u * 1.6 + 20, v * 1.6 + 20, 3) - 0.5;
      const wy = fbm(warp, u * 1.6 + 40, v * 1.6 + 7, 3) - 0.5;
      const px = u * 2.4 + wx * 2.4 + 30;
      const py = v * 2.4 + wy * 2.4 + 30;
      const body = Math.min(1, Math.max(0, (fbm(cloud, px, py, 5) - 0.36) * 3));
      const lines = (1 - Math.abs(fbm(ridge, px * 1.8, py * 1.8, 4) * 2 - 1)) ** 8;
      const r = Math.hypot(u, v) * (0.85 + wx * 0.9);
      const fall = Math.max(0, 1 - r) ** 1.4;
      const a = Math.min(1, (body * 0.85 + lines * 0.9) * fall);
      const k = (y * SPRITE + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = a * 255;
    }
  g.putImageData(img, 0, 0);
  return canvas;
}

/** A soft round glow, white in the middle. */
function glowSprite(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return canvas;
}

/** `sprite` in colour `rgb`, made once per sprite and colour. */
function tinter() {
  const cache = new Map<string, HTMLCanvasElement>();
  const ids = new Map<HTMLCanvasElement, number>();
  return (sprite: HTMLCanvasElement, rgb: Rgb) => {
    if (!ids.has(sprite)) ids.set(sprite, ids.size);
    const key = `${ids.get(sprite)}:${rgb.join(',')}`;
    let out = cache.get(key);
    if (!out) {
      out = document.createElement('canvas');
      out.width = sprite.width;
      out.height = sprite.height;
      const g = out.getContext('2d')!;
      g.drawImage(sprite, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = rgba(rgb, 1);
      g.fillRect(0, 0, out.width, out.height);
      cache.set(key, out);
    }
    return out;
  };
}

export function Fireworks({ color }: { color: string }) {
  const glowRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const glowCanvas = glowRef.current;
    const sparkCanvas = sparkRef.current;
    const bg = glowCanvas?.getContext('2d');
    const fg = sparkCanvas?.getContext('2d');
    if (!glowCanvas || !sparkCanvas || !bg || !fg || reducedMotion()) return;

    const player = lift(toRgb(fg, color), 0.2);
    const palette: Rgb[] = [player, player, GOLD, WHITE, lift(player, 0.6)];
    // Nebula colours from the board art's range (blue to pink-purple).
    const [lo, hi] = NEBULA_HUES;
    const nebulaColours = Array.from({ length: 4 }, (_, i) => toRgb(fg, `hsl(${lo + ((hi - lo) * i) / 3} 80% 58%)`));

    let w = 0;
    let h = 0;
    let maxSparks = 2500;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = sparkCanvas.clientWidth;
      h = sparkCanvas.clientHeight;
      for (const [c, ctx] of [
        [glowCanvas, bg],
        [sparkCanvas, fg],
      ] as const) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      maxSparks = Math.round(Math.min(4500, Math.max(1600, ((w * h) / (1280 * 800)) * 3800)));
    };
    resize();
    window.addEventListener('resize', resize);

    // The nebula sprites take a moment each to make, so they are made one a frame (the first one now).
    const sprites: HTMLCanvasElement[] = [nebulaSprite(Math.floor(rand(1, 1e6)))];
    const glow = glowSprite();
    const tint = tinter();

    const rockets: Rocket[] = [];
    let sparks: Spark[] = [];
    let clouds: Cloud[] = [];
    let flashes: Light[] = [];
    let waves: Light[] = [];
    // Bursts scale with the screen, so a phone isn't swamped and a monitor isn't sparse.
    const unit = () => Math.min(Math.max(Math.min(w, h) / 700, 0.55), 1.4);

    let clock = 0;
    /** The fireworks stay quieter while the fanfare plays. */
    const level = () => (clock < FANFARE_HITS.final + 2.5 ? 0.45 : 1);

    const spark = (s: Partial<Spark> & Pick<Spark, 'x' | 'y' | 'vx' | 'vy' | 'rgb'>) => {
      if (sparks.length >= maxSparks) return;
      const life = s.life ?? rand(1.1, 1.8);
      sparks.push({ size: 2.2, drag: 1.4, gravity: GRAVITY, glitter: false, split: false, tail: false, max: life, ...s, life });
    };

    /** `n` sparks flung evenly round a circle at `speed`, squashed vertically by `tilt` (a ring seen at an angle) and turned by `turn`. */
    const sphere = (
      x: number,
      y: number,
      n: number,
      speed: number,
      rgb: (i: number) => Rgb,
      extra: Partial<Spark> = {},
      tilt = 1,
      turn = 0,
    ) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.04, 0.04);
        const v = speed * (extra.split || tilt !== 1 ? 1 : rand(0.72, 1.05));
        const ex = Math.cos(a) * v;
        const ey = Math.sin(a) * v * tilt;
        spark({
          x,
          y,
          vx: ex * Math.cos(turn) - ey * Math.sin(turn),
          vy: ex * Math.sin(turn) + ey * Math.cos(turn),
          rgb: rgb(i),
          ...extra,
        });
      }
    };

    /** Glowing smoke round (x, y): `n` nebula puffs about `size` across, in `colours`. */
    const nebula = (x: number, y: number, size: number, n: number, colours: Rgb[], peak: number) => {
      for (let i = 0; i < n; i++) {
        const life = rand(3.5, 6);
        clouds.push({
          x: x + rand(-0.35, 0.35) * size,
          y: y + rand(-0.3, 0.3) * size,
          vx: rand(-14, 14),
          vy: rand(-16, 2),
          r0: size * 0.35,
          r1: size * rand(0.85, 1.3),
          rot: rand(0, Math.PI * 2),
          spin: rand(-0.12, 0.12),
          life,
          max: life,
          peak: peak * rand(0.75, 1.2),
          img: tint(pick(sprites), colours[i % colours.length]),
        });
      }
      // The sky can only hold so much smoke: the oldest goes first.
      if (clouds.length > 36) clouds = clouds.slice(clouds.length - 36);
    };

    const queue: { at: number; fn: () => void }[] = [];
    const at = (t: number, fn: () => void) => queue.push({ at: t, fn });

    const burst = (r: Rocket) => {
      const { x, y, rgb, alt } = r;
      const k = r.scale * unit();
      const big = r.shape === 'supernova';
      let crackling = false;
      let smoke: Rgb[] = [rgb, pick(nebulaColours), pick(nebulaColours)];
      let puffs = 3;
      switch (r.shape) {
        case 'peony':
          crackling = Math.random() < 0.5;
          sphere(x, y, 110, 320 * k, () => rgb, { glitter: crackling });
          sphere(x, y, 30, 130 * k, () => WHITE, { life: 0.9 });
          break;
        case 'brocade':
          crackling = true;
          sphere(x, y, 80, 300 * k, () => GOLD, { tail: true, glitter: true, drag: 1.8, gravity: 90, life: rand(2, 2.6), size: 1.8 });
          sphere(x, y, 36, 150 * k, () => rgb, { life: 1.2 });
          break;
        case 'double':
          sphere(x, y, 90, 340 * k, () => rgb);
          sphere(x, y, 60, 180 * k, () => alt, { glitter: true });
          break;
        case 'ring':
          sphere(x, y, 80, 310 * k, () => rgb, { gravity: 60, life: rand(1.3, 1.6) }, rand(0.35, 1), rand(-0.6, 0.6));
          sphere(x, y, 20, 80 * k, () => alt, { gravity: 60, life: 1 });
          break;
        case 'planet':
          // A glowing world with a tilted ring round it.
          sphere(x, y, 70, 140 * k, () => rgb, { gravity: 40, drag: 2.2, life: rand(1.6, 2) });
          sphere(
            x,
            y,
            100,
            340 * k,
            (i) => (i % 2 ? GOLD : alt),
            { gravity: 40, glitter: true, life: rand(1.6, 2) },
            0.28,
            rand(-0.45, 0.45),
          );
          break;
        case 'galaxy': {
          // Spiral arms winding out from a white core, blue-violet at their tips, seen at a slant.
          crackling = true;
          const arms = pick([2, 3]);
          const turn = rand(0, Math.PI);
          const tilt = rand(0.45, 0.7);
          const swirl = pick([-1, 1]);
          const tip = pick(nebulaColours);
          for (let i = 0; i < 160; i++) {
            const t = rand(0.06, 1);
            const a = ((i % arms) / arms) * Math.PI * 2 + swirl * t * 2.8 + rand(-0.14, 0.14);
            const v = (50 + 330 * t) * k;
            const dir = a + swirl * 0.9;
            const ex = Math.cos(dir) * v;
            const ey = Math.sin(dir) * v * tilt;
            spark({
              x,
              y,
              vx: ex * Math.cos(turn) - ey * Math.sin(turn),
              vy: ex * Math.sin(turn) + ey * Math.cos(turn),
              rgb: t < 0.3 ? WHITE : t < 0.65 ? rgb : tip,
              gravity: 30,
              drag: 1.6,
              life: rand(1.6, 2.3),
              glitter: t > 0.6,
              size: t < 0.3 ? 2.6 : 2,
            });
          }
          sphere(x, y, 30, 60 * k, () => WHITE, { gravity: 20, drag: 2, life: 1.4, size: 3 });
          smoke = [tip, rgb, pick(nebulaColours), tip];
          puffs = 5;
          break;
        }
        case 'willow':
          crackling = true;
          sphere(x, y, 140, 280 * k, () => GOLD, { drag: 2.4, gravity: 70, life: rand(2.6, 3.4), glitter: true, tail: true, size: 1.5 });
          smoke = [GOLD, pick(nebulaColours)];
          break;
        case 'crossette':
          sphere(x, y, 18, 300 * k, () => rgb, { split: true, life: rand(0.55, 0.75), size: 2.6, drag: 0.8 });
          break;
        case 'supernova': {
          // The big one: a blinding core, a glittering shell, a tilted ring and a vast golden canopy,
          // then a chain of smaller bursts round its edge.
          crackling = true;
          sphere(x, y, 70, 220 * k, () => WHITE, { life: 0.7, size: 3.2 });
          sphere(x, y, 170, 430 * k, () => rgb, { glitter: true, tail: true, life: rand(1.6, 2.1) });
          sphere(x, y, 110, 470 * k, (i) => (i % 2 ? alt : GOLD), { glitter: true, gravity: 50, life: 1.9 }, 0.3, rand(-0.3, 0.3));
          sphere(x, y, 140, 560 * k, () => GOLD, { drag: 2, gravity: 60, life: rand(2.8, 3.6), glitter: true, size: 1.6 });
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3);
            const d = rand(200, 280) * k;
            const echo: Rocket = {
              ...r,
              x: x + Math.cos(a) * d,
              y: y + Math.sin(a) * d * 0.8,
              shape: 'peony',
              scale: 0.45,
              rgb: pick(palette),
              level: r.level * 0.5,
            };
            at(clock + rand(0.45, 0.9), () => burst(echo));
          }
          smoke = [rgb, ...nebulaColours, alt];
          puffs = 9;
          break;
        }
      }
      // The sky lights up, a shock wave races out, and the smoke is left glowing as a nebula.
      const reach = (big ? 2 : 1) * 320 * k;
      const flash = big ? 0.8 : 0.45;
      const wave = big ? 0.9 : 0.5;
      flashes.push({ x, y, r: reach * 1.6, life: flash, max: flash, rgb: lift(rgb, 0.4) });
      waves.push({ x, y, r: reach * 0.85, life: wave, max: wave, rgb: lift(rgb, 0.6) });
      if (r.scale >= 0.6) nebula(x, y, reach * 0.9, puffs, smoke, big ? 0.2 : 0.13);
      show.burst(Math.min(1.5, r.scale * (big ? 1.3 : 1)), { crackling, level: r.level, distance: big ? 0.05 : rand(0.1, 0.9) });
    };

    const launch = (o: LaunchOptions = {}) => {
      const flight = o.flight ?? rand(0.95, 1.35);
      const x = (o.x ?? rand(0.12, 0.88)) * w;
      const peak = (o.y ?? rand(0.12, 0.42)) * h;
      // Climbing `rise` in `flight` seconds, slowing to a stop: v = 2·rise/t, g = 2·rise/t².
      const rise = h + 4 - peak;
      const vx = rand(-25, 25);
      const rgb = o.rgb ?? pick(palette);
      rockets.push({
        x: x - vx * flight,
        y: h + 4,
        vx,
        vy: (-2 * rise) / flight,
        g: (2 * rise) / (flight * flight),
        t: flight,
        shape: o.shape ?? pick(SHAPES),
        rgb,
        alt: rgb === GOLD ? WHITE : pick([GOLD, WHITE, player, pick(nebulaColours)]),
        scale: o.scale ?? rand(0.9, 1.15),
        level: level(),
      });
      show.launch(flight, level() * 0.6);
    };

    /** A rocket that bursts `t` seconds into the show (launched as late as it can be). */
    const fire = (t: number, o: LaunchOptions = {}) => {
      const flight = Math.min(o.flight ?? rand(0.95, 1.3), Math.max(t, 0.35));
      at(t - flight, () => launch({ ...o, flight }));
    };

    // The show, timed to the fanfare (sound.ts): three quick bursts on the pickups, one on each long note,
    // galaxies on the climb, a supernova on the last chord, a dense finale ending in a second supernova,
    // then a slower display for as long as the popup stays.
    const H = FANFARE_HITS;
    H.pickups.forEach((t, i) => fire(t, { shape: 'peony', scale: 0.6, flight: 0.65, x: 0.25 + i * 0.25, y: 0.2 }));
    fire(H.first, { shape: 'double', x: 0.3, y: 0.28, scale: 1.1 });
    fire(H.first, { shape: 'ring', x: 0.72, y: 0.22 });
    fire(H.second, { shape: 'planet', x: 0.5, y: 0.18, scale: 1.15 });
    fire(H.second + 0.1, { shape: 'crossette', x: 0.15, y: 0.35 });
    fire(H.second + 0.1, { shape: 'crossette', x: 0.85, y: 0.35 });
    fire(H.rise[0], { shape: 'galaxy', x: 0.25, y: 0.25 });
    fire(H.rise[1], { shape: 'galaxy', x: 0.75, y: 0.25 });
    fire(H.final, { shape: 'supernova', x: 0.5, y: 0.26, scale: 1.4, rgb: player, flight: 1.2 });
    fire(H.final + 0.25, { shape: 'willow', x: 0.12, y: 0.3 });
    fire(H.final + 0.25, { shape: 'willow', x: 0.88, y: 0.3 });
    [4.3, 4.7, 5.2].forEach((t) => fire(t, { shape: pick<Shape>(['brocade', 'planet', 'galaxy', 'double']) }));
    for (let i = 0; i < 16; i++) fire(5.9 + i * 0.15 + rand(0, 0.08), { scale: rand(0.85, 1.2) });
    fire(8.6, { shape: 'supernova', x: rand(0.35, 0.65), y: 0.24, scale: 1.3 });
    fire(8.8, { shape: 'willow', x: 0.2, y: 0.32 });
    fire(8.8, { shape: 'willow', x: 0.8, y: 0.32 });
    let next = 10.5;

    const halo = (x: number, y: number, rgb: Rgb, a: number, size: number) => {
      bg.globalAlpha = a;
      bg.drawImage(tint(glow, rgb), x - size, y - size, 2 * size, 2 * size);
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // A long gap (a hidden tab) shouldn't fling everything at once.
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      clock += dt;
      if (sprites.length < SPRITES) sprites.push(nebulaSprite(Math.floor(rand(1, 1e6))));

      for (let i = queue.length - 1; i >= 0; i--)
        if (queue[i].at <= clock) {
          const [{ fn }] = queue.splice(i, 1);
          fn();
        }
      if (clock > next) {
        launch();
        if (Math.random() < 0.3) launch({ scale: rand(0.7, 1) });
        next = clock + rand(1, 2);
      }

      // The glow layer is redrawn from scratch: nebulae, lit sky, shock waves, and the sparks' halos.
      bg.globalCompositeOperation = 'source-over';
      bg.clearRect(0, 0, w, h);
      bg.globalCompositeOperation = 'lighter';
      clouds = clouds.filter((c) => {
        c.life -= dt;
        if (c.life <= 0) return false;
        const age = c.max - c.life;
        const t = age / c.max;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.spin * dt;
        const r = c.r0 + (c.r1 - c.r0) * (1 - (1 - Math.min(1, t * 2)) ** 3);
        bg.globalAlpha = c.peak * Math.min(1, age / 0.4) * (1 - t) ** 1.3;
        bg.save();
        bg.translate(c.x, c.y);
        bg.rotate(c.rot);
        bg.drawImage(c.img, -r, -r, 2 * r, 2 * r);
        bg.restore();
        return true;
      });
      bg.globalAlpha = 1;
      flashes = flashes.filter((f) => {
        f.life -= dt;
        if (f.life <= 0) return false;
        const a = (f.life / f.max) ** 2;
        const grad = bg.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        grad.addColorStop(0, rgba(f.rgb, 0.3 * a));
        grad.addColorStop(0.3, rgba(f.rgb, 0.1 * a));
        grad.addColorStop(1, rgba(f.rgb, 0));
        bg.fillStyle = grad;
        bg.fillRect(f.x - f.r, f.y - f.r, 2 * f.r, 2 * f.r);
        return true;
      });
      waves = waves.filter((v) => {
        v.life -= dt;
        if (v.life <= 0) return false;
        const p = 1 - v.life / v.max;
        const grow = 1 - (1 - p) ** 3;
        bg.strokeStyle = rgba(v.rgb, 0.3 * (1 - p) ** 2);
        bg.lineWidth = 1 + 4 * (1 - p);
        bg.beginPath();
        bg.ellipse(v.x, v.y, v.r * grow, v.r * 0.8 * grow, 0, 0, Math.PI * 2);
        bg.stroke();
        return true;
      });

      // The spark layer fades rather than clears, so every spark leaves a short trail.
      fg.globalCompositeOperation = 'destination-out';
      fg.fillStyle = 'rgba(0,0,0,0.22)';
      fg.fillRect(0, 0, w, h);
      fg.globalCompositeOperation = 'lighter';
      fg.lineCap = 'round';

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        const px = r.x;
        const py = r.y;
        r.vy += r.g * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.t -= dt;
        fg.strokeStyle = 'rgba(255, 220, 160, 0.95)';
        fg.lineWidth = 2.2;
        fg.beginPath();
        fg.moveTo(px, py);
        fg.lineTo(r.x, r.y);
        fg.stroke();
        halo(r.x, r.y, GOLD, 0.7, 10);
        if (Math.random() < 0.7) {
          spark({ x: r.x, y: r.y, vx: rand(-20, 20), vy: rand(10, 50), rgb: GOLD, life: rand(0.3, 0.6), size: 1.2, gravity: 60 });
        }
        if (r.t <= 0) {
          rockets.splice(i, 1);
          burst(r);
        }
      }

      const split: Spark[] = [];
      const embers: Spark[] = [];
      sparks = sparks.filter((s) => {
        s.life -= dt;
        if (s.life <= 0) {
          if (s.split) split.push(s);
          return false;
        }
        const px = s.x;
        const py = s.y;
        const slow = Math.exp(-s.drag * dt);
        s.vx *= slow;
        s.vy = s.vy * slow + s.gravity * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const t = s.life / s.max;
        let a = Math.min(1, t * 1.6);
        if (s.glitter && t < 0.6) a *= Math.random() < 0.5 ? 0.15 : 1;
        // Hot sparks burn white before they cool to their colour.
        const heat = Math.max(0, (t - 0.88) / 0.12);
        const [cr, cg, cb] = s.rgb;
        const mix = (c: number) => Math.round(c + (255 - c) * heat);
        fg.strokeStyle = `rgba(${mix(cr)},${mix(cg)},${mix(cb)},${a})`;
        fg.lineWidth = s.size;
        fg.beginPath();
        fg.moveTo(px, py);
        fg.lineTo(s.x, s.y);
        fg.stroke();
        if (s.size >= 1.5 && a > 0.3) halo(s.x, s.y, s.rgb, a * 0.35, s.size * 4);
        if (s.tail && t > 0.15 && Math.random() < 0.3) {
          embers.push({
            ...s,
            vx: s.vx * 0.1 + rand(-10, 10),
            vy: s.vy * 0.1 + rand(0, 15),
            rgb: GOLD,
            life: rand(0.3, 0.6),
            max: 0.6,
            size: 1,
            drag: 2,
            gravity: 50,
            tail: false,
            glitter: false,
            split: false,
          });
        }
        return true;
      });
      bg.globalAlpha = 1;
      for (const e of embers) if (sparks.length < maxSparks) sparks.push(e);
      for (const s of split) sphere(s.x, s.y, 10, 120 * unit(), () => pick([s.rgb, WHITE, GOLD]), { life: rand(0.5, 0.8), size: 1.5 });
      if (split.length) show.pops(level());
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [color]);

  return (
    <>
      <canvas ref={glowRef} className="fireworks" aria-hidden />
      <canvas ref={sparkRef} className="fireworks" aria-hidden />
    </>
  );
}
