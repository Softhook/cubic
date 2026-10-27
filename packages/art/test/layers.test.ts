import { describe, expect, it } from 'vitest';
import { RASTER_AREA, editableTileSvg, rasterLayerSvg, tileLayerNames, tileLayers, tileSpec, tileSvg, type TileLook } from '../src';

/**
 * A tile as layers (tile/index.ts `tileLayers`): one order for each look, which print, the Art Lab's editable
 * export and the map all draw from.
 */

const seven = tileSpec('p7-01');
const blank = tileSpec('blank-01');
const names = (look: TileLook, o: Parameters<typeof tileLayers>[1] = {}) => tileLayers(seven, { look, ...o }).map((l) => l.name);

describe('tile layers', () => {
  it('stack as printed', () => {
    expect(names('square', { markings: true })).toEqual(['sky', 'body', 'label', 'spaces', 'planet']);
    expect(names('hex', { markings: true })).toEqual(['sky', 'body', 'spaces', 'planet']);
  });

  it('carry markings only when asked', () => {
    expect(names('square', { markings: 'spaces' })).toEqual(['sky', 'body', 'label', 'spaces']);
    // The label only where it fits: not with the planet at the tile's top left.
    expect(names('square', { planetAt: 'nw' })).toEqual(['sky', 'body']);
  });

  /** A tile's layers' drawing, by name, in order. */
  const body = (look: TileLook, ...of: string[]) =>
    tileLayers(seven, { look, markings: true, bleed: true })
      .filter((l) => of.includes(l.name))
      .map((l) => l.art.body)
      .join('');

  it.each([
    ['square', ['label', 'spaces', 'planet']],
    ['hex', ['spaces', 'planet']],
  ] as const)('leave out of their raster part only what an editor keeps as vectors (%s)', (look, vectors) => {
    const o = { look, markings: true, bleed: true };
    expect(tileSvg(seven, { ...o, raster: true })).toBe(tileSvg(seven, o).replace(body(look, ...vectors), ''));
  });

  it('go into an editor as a bitmap and, over it, the vector layers in their groups', () => {
    const editable = (look: TileLook) => editableTileSvg(seven, 'x', { look, markings: true, bleed: true });
    expect(editable('square')).toContain(
      `<g id="label">${body('square', 'label')}</g><g id="markings">${body('square', 'spaces', 'planet')}</g>`,
    );
    expect(editable('hex')).toContain(`<g id="label"></g><g id="markings">${body('hex', 'spaces', 'planet')}</g>`);
  });
});

describe('raster layers alone, for the map', () => {
  it('are the look’s own', () => {
    for (const look of ['square', 'hex'] as const)
      for (const layer of ['sky', 'body'] as const) {
        expect(tileLayerNames(look)).toContain(layer);
        expect(rasterLayerSvg(seven, look, layer)).toMatch(/^<svg /);
      }
  });

  it('are drawn over their area', () => {
    const viewBox = (svg: string) => /viewBox="([^"]+)"/.exec(svg)![1];
    const box = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => `${x} ${y} ${w} ${h}`;
    expect(viewBox(rasterLayerSvg(seven, 'square', 'sky'))).toBe(box(RASTER_AREA.sky));
    expect(viewBox(rasterLayerSvg(seven, 'square', 'body'))).toBe(box(RASTER_AREA.body));
  });
});

describe('a blank tile', () => {
  const layer = (spec: typeof seven, look: TileLook, name: string) =>
    tileLayers(spec, { look, markings: true }).find((l) => l.name === name)?.art.body;

  it('is open ground: seven wells, without a Void’s research flask, and nothing on it', () => {
    expect(layer(blank, 'hex', 'body')).toBe('');
    expect(layer(blank, 'hex', 'planet')).toBe('');
    expect(layer(blank, 'hex', 'spaces')!.match(/<polygon/g)).toHaveLength(7);
    // The flask's faint stroke, which a Void's spaces have.
    expect(layer(tileSpec('void'), 'hex', 'spaces')).toContain('stroke-opacity=".15"');
    expect(layer(blank, 'hex', 'spaces')).not.toContain('stroke-opacity=".15"');
  });
});
