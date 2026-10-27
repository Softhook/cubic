import { describe, expect, it } from 'vitest';
import { RASTER_AREA, TILE_LAYERS, editableTileSvg, rasterLayerSvg, tileLayers, tileSpec, tileSvg } from '../src';

/**
 * A tile as layers (tile/index.ts `tileLayers`): one order, which print, the Art Lab's editable export and
 * the map all draw from.
 */

const seven = tileSpec('p7-01');
const names = (o: Parameters<typeof tileLayers>[1] = {}) => tileLayers(seven, o).map((l) => l.name);

describe('tile layers', () => {
  it('stack as printed', () => {
    expect(names({ markings: true })).toEqual(['sky', 'body', 'label', 'spaces', 'planet']);
    expect(names({ markings: true })).toEqual(TILE_LAYERS);
  });

  it('carry markings only when asked', () => {
    expect(names({ markings: 'spaces' })).toEqual(['sky', 'body', 'label', 'spaces']);
    // The label only where it fits: not with the planet at the tile's top left.
    expect(names({ planetAt: 'nw' })).toEqual(['sky', 'body']);
  });

  /** A tile's layers' drawing, by name, in order. */
  const body = (...of: string[]) =>
    tileLayers(seven, { markings: true, bleed: true })
      .filter((l) => of.includes(l.name))
      .map((l) => l.art.body)
      .join('');

  it('leave out of their raster part only what an editor keeps as vectors', () => {
    const o = { markings: true, bleed: true };
    expect(tileSvg(seven, { ...o, raster: true })).toBe(tileSvg(seven, o).replace(body('label', 'spaces', 'planet'), ''));
  });

  it('go into an editor as a bitmap and, over it, the vector layers in their groups', () => {
    expect(editableTileSvg(seven, 'x', { markings: true, bleed: true })).toContain(
      `<g id="label">${body('label')}</g><g id="markings">${body('spaces', 'planet')}</g>`,
    );
  });
});

describe('raster layers alone, for the map', () => {
  it('are drawn over their area', () => {
    const viewBox = (svg: string) => /viewBox="([^"]+)"/.exec(svg)![1];
    const box = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => `${x} ${y} ${w} ${h}`;
    expect(viewBox(rasterLayerSvg(seven, 'sky'))).toBe(box(RASTER_AREA.sky));
    expect(viewBox(rasterLayerSvg(seven, 'body'))).toBe(box(RASTER_AREA.body));
  });
});
