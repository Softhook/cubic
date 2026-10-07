import { CARD, cardSvg, dataUrl, hash } from '@quantum/art';
import { rasterise } from '../files';
import { cardFontCss, cardFontsReady, faceOf, measure } from '../lab/cards';
import { idle, storeImage, storedImage } from './imageStore';

/**
 * Printed card artwork as ready-drawn images, for the card pop-ups. Each card's SVG (with its
 * illustration's filters) is drawn once to a bitmap, so a pop-up of a whole deck doesn't redraw live
 * filters on every repaint, and kept in IndexedDB (imageStore), so later visits show it at once. The
 * stored image carries a hash of the SVG, so changing the artwork redraws it automatically.
 */

/** Pixel width of a drawn card: the largest pop-up card (300 px) at 2× device pixels. */
const WIDTH = 600;
const HEIGHT = Math.round((WIDTH * CARD.h) / CARD.w);

const images = new Map<string, Promise<string>>();
const ready = new Map<string, string>();

/**
 * Cards are drawn a few at a time, in the order asked for, so a deck's pop-up fills in from its first
 * card instead of showing them all at the end.
 */
const AT_ONCE = 2;
let drawing = 0;
const waiting: (() => void)[] = [];
const slot = () => (drawing < AT_ONCE ? (drawing++, Promise.resolve()) : new Promise<void>((resolve) => waiting.push(resolve)));
const release = () => {
  const next = waiting.shift();
  if (next) next();
  else drawing--;
};

async function draw(id: string): Promise<string> {
  const face = faceOf(id);
  // The layout is measured with the page's fonts; the key leaves out the embedded font files.
  await cardFontsReady();
  const key = `${hash(cardSvg(face, { rounded: true, measure }))}:${WIDTH}`;
  const stored = await storedImage('cards', id, key).catch(() => undefined);
  if (stored) return URL.createObjectURL(stored);
  const fontCss = await cardFontCss();
  const svg = cardSvg(face, { rounded: true, measure, fontCss });
  await slot();
  try {
    const blob = await rasterise(svg, WIDTH, HEIGHT, 'image/webp', 0.92);
    // Without its fonts (offline) a card falls back to system lettering: shown, but not kept.
    if (fontCss) storeImage('cards', id, key, blob).catch(() => {});
    return URL.createObjectURL(blob);
  } catch {
    // If drawing fails, fall back to the SVG itself (slower to show, same look).
    return dataUrl(svg);
  } finally {
    release();
  }
}

/** The image URL for a card's front, drawing it the first time. */
export function cardImage(id: string): Promise<string> {
  let image = images.get(id);
  if (!image) {
    image = draw(id).then((url) => (ready.set(id, url), url));
    images.set(id, image);
  }
  return image;
}

/** The image URL for a card that has already been drawn, if any: lets a reopened pop-up show at once. */
export const cardImageNow = (id: string) => ready.get(id);

/**
 * Prepares cards in the background (one per idle moment), so their pop-ups open at once. Fetches the
 * card fonts straight away: the first card drawn would otherwise wait for them.
 */
export async function warmCardImages(ids: Iterable<string>): Promise<void> {
  void cardFontCss();
  for (const id of new Set(ids)) {
    if (images.has(id)) continue;
    await idle(2000);
    await cardImage(id).catch(() => {});
  }
}
