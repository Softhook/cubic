import { useMemo, useState } from 'react';
import { TILE_SET, TILE_SPOTS, dataUrl, editableTileSvg, tileSvg, type PlanetType, type TileShape, type TileSpec } from '@quantum/art';
import { blobToDataUrl, download } from '../files';
import { svgToPng } from '../print/exports';
import { PIECES, fileName, pieceSize } from '../print/pieces';
import { PrintPanel, Space } from '../print/PrintPanel';
import { tileFontCss, useFontCss, useSvgUrl } from './cards';
import { LabHeader } from './LabHeader';
import { TILES_AND_AIDS, printableTile } from './pressSheets';

/**
 * Art Lab, tiles page (#lab): every tile of the physical set, with controls to explore seeds and
 * planet types and to export print files: single tiles, the whole set, print sheets, and the CMYK press
 * sheets the tiles share with the player aids. See docs/GRAPHICS.md §3–4. The set can be viewed as hex
 * tiles too, and with its planets moved off the middle, as maps place them (docs/HEX.md); the print files
 * stay the square set as printed.
 */

const TYPES: PlanetType[] = ['gas', 'rocky', 'ice', 'lava', 'ocean'];

type Override = Partial<Pick<TileSpec, 'seed' | 'type' | 'rings'>>;

export function TileLab() {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [selected, setSelected] = useState(TILE_SET[0].id);
  const [markings, setMarkings] = useState(true);
  const [bleed, setBleed] = useState(false);
  const [shape, setShape] = useState<TileShape>('square');
  // Where the planets sit, as a map's layout token says (`7ne`): '' for the middle.
  const [planetAt, setPlanetAt] = useState('');
  // The number and label fonts, embedded in the detail view and the print files (thumbnails use the system's).
  const fonts = useFontCss(tileFontCss);

  const specs = useMemo(() => TILE_SET.map((t) => ({ ...t, ...overrides[t.id] })), [overrides]);
  const thumbs = useMemo(
    () => specs.map((t) => ({ spec: t, url: dataUrl(tileSvg(t, { markings, rounded: true, shape, planetAt })) })),
    [specs, markings, shape, planetAt],
  );
  const spec = specs.find((t) => t.id === selected)!;
  // A hex tile is shown cut to its flower; a square one as printed, with its bleed.
  const svg = useMemo(
    () => tileSvg(spec, { markings, bleed, fontCss: fonts ?? '', shape, planetAt, rounded: shape === 'hex' }),
    [spec, markings, bleed, fonts, shape, planetAt],
  );
  const detail = useSvgUrl(svg);
  const set = (o: Override) => setOverrides((all) => ({ ...all, [spec.id]: { ...all[spec.id], ...o } }));

  // Prints the set as shown: seeds and types being explored, and the markings setting, included.
  const printable = (t: TileSpec) => printableTile(t, fonts ?? '', markings);
  const item = printable(spec);

  /** Illustrator can't render SVG filters, so the art goes in as a 600 dpi bitmap with vector markings on top. */
  const exportEditable = async () => {
    const { w, h } = pieceSize(PIECES.tile, bleed);
    const art = await blobToDataUrl(await svgToPng(tileSvg(spec, { only: 'art', bleed }), w, h, 600));
    const name = fileName(PIECES.tile, item, { bleed, ext: 'svg' }).replace(/\.svg$/, '-illustrator.svg');
    download(name, new Blob([editableTileSvg(spec, art, { bleed, markings })], { type: 'image/svg+xml' }));
  };

  return (
    <div className="lab">
      <LabHeader page="tiles">
        <label>
          <input type="checkbox" checked={markings} onChange={(e) => setMarkings(e.target.checked)} /> Print markings
        </label>
        <label>
          Shape
          <select
            value={shape}
            onChange={(e) => {
              const next = e.target.value as TileShape;
              setShape(next);
              if (!(planetAt in TILE_SPOTS[next])) setPlanetAt('');
            }}
          >
            <option value="square">Square</option>
            <option value="hex">Hex</option>
          </select>
        </label>
        <label title="Where each planet sits on its tile, as a map's layout token says (7ne)">
          Planet
          <select value={planetAt} onChange={(e) => setPlanetAt(e.target.value)}>
            {Object.keys(TILE_SPOTS[shape]).map((d) => (
              <option key={d} value={d}>
                {d || 'middle'}
              </option>
            ))}
          </select>
        </label>
      </LabHeader>
      <div className="lab-body">
        <div className="lab-grid">
          {thumbs.map(({ spec: t, url }) => (
            <button key={t.id} className={`lab-thumb ${t.id === selected ? 'on' : ''}`} onClick={() => setSelected(t.id)}>
              <img src={url} alt={t.id} />
              <span>
                {t.id}
                {t.type ? ` · ${t.type}` : ''}
              </span>
            </button>
          ))}
        </div>
        <aside className="lab-detail">
          <img src={detail} alt={spec.id} />
          <div className="lab-controls">
            <label>
              Seed
              <input type="number" value={spec.seed} onChange={(e) => set({ seed: Number(e.target.value) >>> 0 })} />
            </label>
            <button className="btn" onClick={() => set({ seed: Math.floor(Math.random() * 2 ** 32) })}>
              Reroll
            </button>
            {spec.number > 0 && (
              <>
                <label>
                  Type
                  <select value={spec.type} onChange={(e) => set({ type: e.target.value as PlanetType })}>
                    {TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Rings
                  <select
                    value={spec.rings === undefined ? 'auto' : String(spec.rings)}
                    onChange={(e) => set({ rings: e.target.value === 'auto' ? undefined : e.target.value === 'true' })}
                  >
                    <option value="auto">from seed</option>
                    <option value="true">on</option>
                    <option value="false">off</option>
                  </select>
                </label>
              </>
            )}
            {overrides[spec.id] && (
              <button className="btn btn-ghost" onClick={() => setOverrides(({ [spec.id]: _, ...rest }) => rest)}>
                Reset
              </button>
            )}
          </div>
          {(shape !== 'square' || planetAt) && (
            <p className="lab-note">
              Shown {shape === 'hex' ? 'as a hex tile' : 'as a square tile'}
              {planetAt ? ` with its planet ${planetAt} of the middle` : ''}. The print files below are the square set as printed.
              {planetAt && spec.number > 8 ? ' Only 7s and 8s sit off the middle on a map: a 9 or 10 spills over the edge.' : ''}
            </p>
          )}
          <p className="lab-note">Changes here are for exploring; to keep one, copy its settings:</p>
          <pre className="lab-spec">{JSON.stringify(spec)}</pre>
          <PrintPanel
            piece={PIECES.tile}
            item={item}
            bleed={bleed}
            onBleed={setBleed}
            set={specs.map(printable)}
            notes={markings ? '' : 'Without print markings.\n'}
            sheets={() => specs.map((t) => ({ front: printable(t) }))}
            cmyk={TILES_AND_AIDS}
            ready={fonts !== null}
            fontsMissing={fonts === ''}
            cmykDiffers={
              [Object.keys(overrides).length > 0 && 'seeds or types changed here', !markings && 'print markings off']
                .filter(Boolean)
                .join(', ') || undefined
            }
            extra={(run, busy) => (
              <button
                className="btn"
                disabled={busy}
                onClick={() => run(exportEditable)}
                title="Art as a 600 dpi RGB image, markings as editable vectors"
              >
                <Space of="rgb" /> SVG for Illustrator
              </button>
            )}
          />
        </aside>
      </div>
    </div>
  );
}
