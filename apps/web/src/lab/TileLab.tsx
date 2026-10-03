import { useMemo, useState } from 'react';
import { TILE, TILE_SET, dataUrl, editableTileSvg, tileSvg, type PlanetType, type TileSpec } from '@quantum/art';
import { blobToDataUrl, download, svgToPng } from './export';
import { LabHeader } from './LabHeader';

/**
 * Art Lab, tiles page (#lab): every tile of the physical set, with controls to explore seeds and
 * planet types and to export print files. See docs/GRAPHICS.md §3.
 */

const TYPES: PlanetType[] = ['gas', 'rocky', 'ice', 'lava', 'ocean'];

type Override = Partial<Pick<TileSpec, 'seed' | 'type' | 'rings'>>;

export function TileLab() {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [selected, setSelected] = useState(TILE_SET[0].id);
  const [markings, setMarkings] = useState(true);
  const [bleed, setBleed] = useState(false);
  const [busy, setBusy] = useState(false);

  const specs = useMemo(() => TILE_SET.map((t) => ({ ...t, ...overrides[t.id] })), [overrides]);
  const thumbs = useMemo(() => specs.map((t) => ({ spec: t, url: dataUrl(tileSvg(t, { markings, rounded: true })) })), [specs, markings]);
  const spec = specs.find((t) => t.id === selected)!;
  const svg = useMemo(() => tileSvg(spec, { markings, bleed }), [spec, markings, bleed]);
  const set = (o: Override) => setOverrides((all) => ({ ...all, [spec.id]: { ...all[spec.id], ...o } }));
  const mm = TILE.size + (bleed ? 2 * TILE.bleed : 0);
  const name = `tile-${spec.id}${bleed ? '-bleed' : ''}`;

  const exportPng = async (dpi: number) => {
    setBusy(true);
    try {
      download(`${name}-${dpi}dpi.png`, await svgToPng(svg, mm, mm, dpi));
    } finally {
      setBusy(false);
    }
  };

  /** Illustrator can't render SVG filters, so the art goes in as a 600 dpi bitmap with vector markings on top. */
  const exportEditable = async () => {
    setBusy(true);
    try {
      const art = await blobToDataUrl(await svgToPng(tileSvg(spec, { only: 'art', bleed }), mm, mm, 600));
      download(`${name}-illustrator.svg`, new Blob([editableTileSvg(spec, art, { bleed, markings })], { type: 'image/svg+xml' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lab">
      <LabHeader page="tiles">
        <label><input type="checkbox" checked={markings} onChange={(e) => setMarkings(e.target.checked)} /> Print markings</label>
        <label><input type="checkbox" checked={bleed} onChange={(e) => setBleed(e.target.checked)} /> Bleed (detail view)</label>
      </LabHeader>
      <div className="lab-body">
        <div className="lab-grid">
          {thumbs.map(({ spec: t, url }) => (
            <button key={t.id} className={`lab-thumb ${t.id === selected ? 'on' : ''}`} onClick={() => setSelected(t.id)}>
              <img src={url} alt={t.id} />
              <span>{t.id}{t.type ? ` · ${t.type}` : ''}</span>
            </button>
          ))}
        </div>
        <aside className="lab-detail">
          <img src={dataUrl(svg)} alt={spec.id} />
          <div className="lab-controls">
            <label>
              Seed
              <input type="number" value={spec.seed} onChange={(e) => set({ seed: Number(e.target.value) >>> 0 })} />
            </label>
            <button className="btn" onClick={() => set({ seed: Math.floor(Math.random() * 2 ** 32) })}>Reroll</button>
            {spec.number > 0 && (
              <>
                <label>
                  Type
                  <select value={spec.type} onChange={(e) => set({ type: e.target.value as PlanetType })}>
                    {TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label>
                  Rings
                  <select value={spec.rings === undefined ? 'auto' : String(spec.rings)} onChange={(e) => set({ rings: e.target.value === 'auto' ? undefined : e.target.value === 'true' })}>
                    <option value="auto">from seed</option>
                    <option value="true">on</option>
                    <option value="false">off</option>
                  </select>
                </label>
              </>
            )}
            {overrides[spec.id] && <button className="btn btn-ghost" onClick={() => setOverrides(({ [spec.id]: _, ...rest }) => rest)}>Reset</button>}
          </div>
          <div className="lab-controls">
            <button className="btn" disabled={busy} onClick={exportEditable} title="Art as a 600 dpi image, markings as editable vectors">SVG for Illustrator</button>
            <button className="btn btn-ghost" onClick={() => download(`${name}.svg`, new Blob([svg], { type: 'image/svg+xml' }))} title="Live SVG filters: renders in browsers only">SVG (browser only)</button>
            <button className="btn" disabled={busy} onClick={() => exportPng(300)}>PNG 300 dpi</button>
            <button className="btn" disabled={busy} onClick={() => exportPng(600)}>PNG 600 dpi</button>
          </div>
          <p className="lab-note">{mm} × {mm} mm. Changes here are for exploring; to keep one, copy its settings:</p>
          <pre className="lab-spec">{JSON.stringify(spec)}</pre>
        </aside>
      </div>
    </div>
  );
}
