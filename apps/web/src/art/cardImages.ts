import { CARD, cardSvg, dataUrl } from '@quantum/art';
import { rasterise } from '../files';
import { cardFontCss, faceOf, measure } from '../lab/cards';

/**
 * Printed card artwork as ready-drawn images, for the card pop-ups. Each card's SVG (with its
 * illustration's filters) is drawn once to a bitmap per session, so a pop-up of a whole deck
 * doesn't redraw live filters on every repaint.
 */

/** Pixel width of a drawn card: the largest pop-up card (300 px) at 2× device pixels. */
const WIDTH = 600;
const HEIGHT = Math.round((WIDTH * CARD.h) / CARD.w);

const images = new Map<string, Promise<string>>();
const ready = new Map<string, string>();

async function load(id: string): Promise<string> {
  const svg = cardSvg(faceOf(id), { rounded: true, measure, fontCss: await cardFontCss() });
  // If drawing fails, fall back to the SVG itself (slower to show, same look).
  const url = await rasterise(svg, WIDTH, HEIGHT, 'image/webp', 0.92).then(URL.createObjectURL, () => dataUrl(svg));
  ready.set(id, url);
  return url;
}

/** The image URL for a card's front, drawing it the first time. */
export function cardImage(id: string): Promise<string> {
  let image = images.get(id);
  if (!image) {
    image = load(id);
    images.set(id, image);
  }
  return image;
}

/** The image URL for a card that has already been drawn, if any: lets a reopened pop-up show at once. */
export const cardImageNow = (id: string) => ready.get(id);
