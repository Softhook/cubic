import { INKS } from '../screenprint/inks';
import { rgbHex } from '../svg';
import type { World } from '../tile/look';

/**
 * The bases in each world's inks (mood board ObjectiveColours): every colour a base is painted in is
 * redrawn, by its lightness, in a few of the Regolith palette's inks, so the sites stay off the seat
 * colours and the cubes in their sockets stand out. Greys go to warm bone metal on every world; on
 * Phobos and Deimos yellows go to Hazard and every other colour to Oxide and Union (the bulletin's two
 * inks), and on Mars cool colours go to Teal, hot ones to Rust and yellows to Hazard (the survey board's
 * inks), as rust would sink into its oxide ground.
 */

type Rgb = [number, number, number];

/** An ink ramp, dark to light: a colour of that lightness is read off it. */
type Ramp = Rgb[];

const parse = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as Rgb;
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => v + (b[i] - v) * t) as Rgb;

const lightness = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Hue (degrees) and saturation, 0–1. */
function hueOf([r, g, b]: Rgb): [number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return [0, 0];
  const s = d / (1 - Math.abs(max + min - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s];
}

const ramp = (...inks: string[]): Ramp => inks.map(parse).sort((a, b) => lightness(a) - lightness(b));

/** The ink at lightness `l` on `inks`: between its two nearest, below its darkest to near black, above its lightest to near white. */
function read(inks: Ramp, l: number): Rgb {
  const ls = inks.map(lightness);
  if (l <= ls[0]) return mix([0.08, 0.075, 0.07], inks[0], l / ls[0]);
  for (let i = 1; i < inks.length; i++) if (l <= ls[i]) return mix(inks[i - 1], inks[i], (l - ls[i - 1]) / (ls[i] - ls[i - 1]));
  const last = ls.length - 1;
  return mix(inks[last], [1, 0.98, 0.94], (l - ls[last]) / (1 - ls[last]));
}

const BONE = ramp(INKS.key, '#4A4540', '#8C8478', '#CFC8BC', '#EDE7DB');
const HAZARD = ramp('#5b3a08', '#c98a14', INKS.amber, '#ffd27a');
const OXIDE = ramp('#3a1608', '#A8441A', '#D8622A', '#f6b08c');
const TEAL = ramp('#0f4a55', '#1E8597', '#3CB8CE', '#8fe6f2');
const RUST = ramp('#5e2710', '#B24C1E', '#D8622A', '#f6b08c');

/** Which ramp a colour of hue `h` goes to, on each world. */
const RAMP_FOR: Record<World, (h: number) => Ramp> = {
  phobos: (h) => (h >= 30 && h < 75 ? HAZARD : OXIDE),
  deimos: (h) => (h >= 30 && h < 75 ? HAZARD : OXIDE),
  mars: (h) => (h >= 30 && h < 70 ? HAZARD : h >= 70 && h < 320 ? TEAL : RUST),
};

/** Below this saturation a colour is grey, and goes to bone. */
const GREY = 0.18;

/** One colour in `world`'s inks. */
function ink(hex: string, world: World): string {
  const c = parse(hex);
  const [h, s] = hueOf(c);
  return rgbHex(read(s < GREY ? BONE : RAMP_FOR[world](h), lightness(c)));
}

/** Every colour in `svg` in `world`'s inks, but for pure white and black, which masks and lights are drawn in. */
export const inked = (svg: string, world: World) =>
  svg.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/g, (all, hex: string) =>
    /^(f{3}|f{6}|0{3}|0{6})$/i.test(hex) ? all : ink(hex, world),
  );
