// Colours and the small pictures the fireworks are drawn with: nebula clouds and glows, made once and tinted.

export type Rgb = [number, number, number];

export const GOLD: Rgb = [255, 200, 100];
export const WHITE: Rgb = [235, 242, 255];

export const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`;

/** A brighter, paler version of `c`, so dark player colours still glow. */
export const lift = (c: Rgb, by = 0.35): Rgb => c.map((v) => Math.round(v + (255 - v) * by)) as Rgb;

/** Any CSS colour as RGB, by letting the canvas parse it. */
export function toRgb(ctx: CanvasRenderingContext2D, color: string): Rgb {
  ctx.fillStyle = '#ffffff';
  ctx.fillStyle = color;
  const hex = ctx.fillStyle;
  if (hex.startsWith('#') && hex.length === 7) return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  return GOLD;
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

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

/** Fractal noise: `octaves` layers of `noise`, each finer and fainter. */
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

const NEBULA_SIZE = 128;

/**
 * A white nebula cloud on transparent, as the board art draws them: fractal noise swirled by a second
 * noise, with fine bright filaments, fading out raggedly towards its edge.
 */
export function nebulaSprite(seed: number): HTMLCanvasElement {
  const S = NEBULA_SIZE;
  const [c, g] = canvas(S);
  const img = g.createImageData(S, S);
  const cloud = valueNoise(seed);
  const warp = valueNoise(seed + 101);
  const ridge = valueNoise(seed + 202);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x / S) * 2 - 1;
      const v = (y / S) * 2 - 1;
      const wx = fbm(warp, u * 1.6 + 20, v * 1.6 + 20, 3) - 0.5;
      const wy = fbm(warp, u * 1.6 + 40, v * 1.6 + 7, 3) - 0.5;
      const px = u * 2.4 + wx * 2.4 + 30;
      const py = v * 2.4 + wy * 2.4 + 30;
      const body = Math.min(1, Math.max(0, (fbm(cloud, px, py, 5) - 0.36) * 3));
      const lines = (1 - Math.abs(fbm(ridge, px * 1.8, py * 1.8, 4) * 2 - 1)) ** 8;
      const r = Math.hypot(u, v) * (0.85 + wx * 0.9);
      const fall = Math.max(0, 1 - r) ** 1.4;
      const k = (y * S + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.min(1, (body * 0.85 + lines * 0.9) * fall) * 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

/** A soft round glow, white in the middle. */
export function glowSprite(): HTMLCanvasElement {
  const [c, g] = canvas(32);
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c;
}

const tinted = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

/** A white `sprite` in colour `rgb`, made once per sprite and colour. */
export function tint(sprite: HTMLCanvasElement, rgb: Rgb): HTMLCanvasElement {
  let colours = tinted.get(sprite);
  if (!colours) tinted.set(sprite, (colours = new Map()));
  const key = rgb.join(',');
  let out = colours.get(key);
  if (!out) {
    const [c, g] = canvas(sprite.width);
    g.drawImage(sprite, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = rgba(rgb, 1);
    g.fillRect(0, 0, c.width, c.height);
    colours.set(key, (out = c));
  }
  return out;
}
