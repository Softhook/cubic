import { useState, type ReactNode } from 'react';
import { exportPng, exportSvg, exportZip, printSheets, type Progress } from './exports';
import { PRINT_DPI, sizeNote, type Piece, type Printable } from './pieces';
import { PAPER, type Paper } from './sheets';

/** Runs an export with progress messages; the panel is busy until it ends. */
export type Run = (task: (progress: Progress) => Promise<void>) => void;

interface Props {
  piece: Piece;
  /** The face in the detail view, for the single exports. */
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
  /** Offer the "All copies" and "Backs (duplex)" options. */
  copies?: boolean;
  backs?: boolean;
  /** False while the faces can't be drawn yet (fonts loading). */
  ready?: boolean;
  /** More single-face exports, beside the standard ones. */
  extra?: (run: Run, busy: boolean) => ReactNode;
}

/** The print exports for a piece, the same on every Art Lab page: this face, then the whole set. */
export function PrintPanel({ piece, item, bleed, onBleed, set, part, notes, sheets, copies, backs, ready = true, extra }: Props) {
  const [paper, setPaper] = useState<Paper>('a4');
  const [allCopies, setAllCopies] = useState(true);
  const [withBacks, setWithBacks] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const busy = progress !== null || !ready;

  const run: Run = (task) => {
    setProgress('Rendering…');
    void task(setProgress).finally(() => setProgress(null));
  };

  return (
    <>
      <div className="lab-controls">
        <label><input type="checkbox" checked={bleed} onChange={(e) => onBleed(e.target.checked)} /> Bleed</label>
        <button className="btn" disabled={busy} onClick={() => run(() => exportPng(piece, item, bleed, PRINT_DPI))}>PNG {PRINT_DPI} dpi</button>
        <button className="btn" disabled={busy} onClick={() => run(() => exportPng(piece, item, bleed, 600))}>PNG 600 dpi</button>
        {extra?.(run, busy)}
        <button className="btn btn-ghost" disabled={!ready} onClick={() => exportSvg(piece, item, bleed)} title="Live SVG filters: renders in browsers only">SVG (browser only)</button>
      </div>
      <p className="lab-note">{sizeNote(piece, bleed)}{bleed ? ', as print services want it' : ''}.</p>

      <h3 className="lab-sub">Whole set{part && ` (${part})`}</h3>
      <div className="lab-controls">
        <button className="btn btn-primary" disabled={busy} onClick={() => run((p) => exportZip(piece, set, { bleed, part: part?.toLowerCase(), notes }, p))}>
          All {piece.plural} · ZIP
        </button>
        <span className="lab-note">{set.length} PNGs at {PRINT_DPI} dpi{bleed ? ', with bleed' : ''}.</span>
      </div>
      <div className="lab-controls">
        <button className="btn btn-primary" disabled={busy} onClick={() => run((p) => printSheets(piece, sheets(allCopies), paper, withBacks, p))}>
          Print sheets · PDF
        </button>
        <select value={paper} onChange={(e) => setPaper(e.target.value as Paper)} aria-label="Paper">
          {Object.entries(PAPER).map(([id, p]) => (
            <option key={id} value={id}>{p.name}</option>
          ))}
        </select>
        {copies && <label><input type="checkbox" checked={allCopies} onChange={(e) => setAllCopies(e.target.checked)} /> All copies</label>}
        {backs && <label><input type="checkbox" checked={withBacks} onChange={(e) => setWithBacks(e.target.checked)} /> Backs (duplex)</label>}
      </div>
      <p className="lab-note">
        {piece.cols * piece.rows} per page at trim size with crop marks; choose “Save as PDF” in the print dialog and print at 100 % (no fit to page).
        {backs && withBacks && ' Backs follow each page, mirrored for long-edge duplex.'}
      </p>
      {progress && <p className="lab-progress"><span className="spinner" /> {progress}</p>}
    </>
  );
}
