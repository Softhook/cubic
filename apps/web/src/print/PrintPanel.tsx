import { useState, type ReactNode } from 'react';
import { exportCmykSet, exportPng, exportZip, printSheets } from './exports';
import { sizeNote, type Piece, type Printable } from './pieces';
import { PRESS } from './press';
import { PAPER, type Paper } from './sheets';
import { useExport, type Run } from './useExport';

interface Props {
  piece: Piece;
  /** The face in the detail view, for the single export. */
  item: Printable;
  bleed: boolean;
  onBleed: (bleed: boolean) => void;
  /** Every face of the set as shown, for the ZIP. */
  set: Printable[];
  /** Names which part of the set is shown, in the heading and the ZIP's name: "Community". */
  part?: string;
  /** More lines for the ZIP's README. */
  notes?: string;
  /** The faces to print on sheets, with all copies or one of each. */
  sheets: (copies: boolean) => { front: Printable; back?: Printable }[];
  /** Offer the "All copies" and "Backs (duplex)" options on the print sheets. */
  copies?: boolean;
  backs?: boolean;
  /** False while the faces can't be drawn yet (fonts loading). */
  ready?: boolean;
  /** The fonts didn't load (offline): exports are off, so no print file falls back to system fonts. */
  fontsMissing?: boolean;
  /** More single-face exports, beside the standard one. */
  extra?: (run: Run, busy: boolean) => ReactNode;
}

/** The print exports for a piece, the same on every Art Lab page: this face, then the whole set. */
export function PrintPanel({
  piece,
  item,
  bleed,
  onBleed,
  set,
  part,
  notes,
  sheets,
  copies,
  backs,
  ready = true,
  fontsMissing,
  extra,
}: Props) {
  const [paper, setPaper] = useState<Paper>('a4');
  const [allCopies, setAllCopies] = useState(true);
  const [withBacks, setWithBacks] = useState(false);
  const { run, progress, error } = useExport();
  const busy = progress !== null || !ready || !!fontsMissing;
  /** How many of each face a full set prints, by front name: its copies. */
  const quantities = () => {
    const count = new Map<string, number>();
    for (const f of sheets(true)) count.set(f.front.name, (count.get(f.front.name) ?? 0) + 1);
    return count;
  };

  return (
    <>
      <div className="lab-controls">
        <label>
          <input type="checkbox" checked={bleed} onChange={(e) => onBleed(e.target.checked)} /> Bleed
        </label>
        <button className="btn" disabled={busy} onClick={() => run(() => exportPng(piece, item, bleed))}>
          PNG {piece.dpi} dpi
        </button>
        {extra?.(run, busy)}
      </div>
      <p className="lab-note">
        {sizeNote(piece, bleed)}
        {bleed ? ', as print services want it' : ''}. PNGs are opaque, tagged sRGB and carry their dpi.
      </p>
      {fontsMissing && <p className="lab-note">The fonts didn’t load (offline?), so exports are off: they would print in system fonts.</p>}

      <h3 className="lab-sub">Whole set{part && ` (${part})`}</h3>
      <div className="lab-controls">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => run((p) => exportZip(piece, set, { bleed, part: part?.toLowerCase(), notes }, p))}
        >
          All {piece.plural} · ZIP
        </button>
        <span className="lab-note">
          For print services that want RGB: {set.length} PNGs at {piece.dpi} dpi{bleed ? ', with bleed' : ''}.
        </span>
      </div>
      <div className="lab-controls">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => run((p) => exportCmykSet(piece, sheets(false), quantities(), { part: part?.toLowerCase(), notes }, p))}
        >
          CMYK PDFs · {PRESS.condition} · ZIP
        </button>
        <span className="lab-note">
          For print services that want CMYK and a file per {piece.id}: one PDF each with {piece.bleed} mm bleed, no crop marks, {piece.dpi}{' '}
          dpi{backs ? ', its back as page 2' : ''}, and how many to order of each in order.csv. Converted for {PRESS.profile}.
        </span>
      </div>
      <div className="lab-controls">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => run((p) => printSheets(piece, sheets(allCopies), { paper, withBacks }, p))}
        >
          Print sheets · PDF
        </button>
        <select value={paper} onChange={(e) => setPaper(e.target.value as Paper)} aria-label="Paper">
          {Object.entries(PAPER).map(([id, p]) => (
            <option key={id} value={id}>
              {p.name}
            </option>
          ))}
        </select>
        {copies && (
          <label>
            <input type="checkbox" checked={allCopies} onChange={(e) => setAllCopies(e.target.checked)} /> All copies
          </label>
        )}
        {backs && (
          <label>
            <input type="checkbox" checked={withBacks} onChange={(e) => setWithBacks(e.target.checked)} /> Backs (duplex)
          </label>
        )}
      </div>
      <p className="lab-note">
        {piece.cols * piece.rows} per page at trim size with crop marks; choose “Save as PDF” in the print dialog and print at 100 % (no fit
        to page).
        {backs && withBacks && ' Backs follow each page, mirrored for long-edge duplex.'}
      </p>
      {error && <p className="lab-error">Export failed: {error}</p>}
      {progress && (
        <p className="lab-progress">
          <span className="spinner" /> {progress}
        </p>
      )}
    </>
  );
}
