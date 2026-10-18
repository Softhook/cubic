import { useEffect, useMemo, useState } from 'react';
import { PRESS_TEST, cardSvg, dataUrl, pressTestSvg, tileSpec, tileSvg } from '@quantum/art';
import { DECKS, cardFontCss, measure, tileFontCss } from './cards';
import { exportCmykPdf, exportPng } from '../print/exports';
import type { Format, Printable } from '../print/pieces';
import { PRESS } from '../print/press';
import { useExport } from '../print/useExport';
import { LabHeader } from './LabHeader';

/** The tile and the dark card the test prints at 100 %: a dark tile, where the shadows matter most. */
const TILE_ID = 'p10-02';
const CARD = DECKS.find((d) => d.id === 'tactic')!.cards[0];

/** The page as a print format: A4, no bleed. */
const PAGE: Format = { id: 'proof', w: PRESS_TEST.w, h: PRESS_TEST.h, bleed: 0, dpi: 600 };

/**
 * Art Lab, press test page (#lab/proof): one A4 page to print on the real press and stock before a
 * run (proof.ts): as the CMYK PDF a print service gets, or as an RGB PNG for one that converts itself.
 */
export function ProofLab() {
  const [fonts, setFonts] = useState<{ card: string; tile: string } | null>(null);
  const { run, progress, error } = useExport();

  useEffect(() => {
    void Promise.all([cardFontCss(), tileFontCss()]).then(([card, tile]) => setFonts({ card, tile }));
  }, []);

  const svg = useMemo(() => {
    if (!fonts) return '';
    const tile = dataUrl(tileSvg(tileSpec(TILE_ID), { markings: true, fontCss: fonts.tile }));
    const card = dataUrl(cardSvg(CARD, { measure, fontCss: fonts.card }));
    return pressTestSvg({ tile, card, fontCss: fonts.card + fonts.tile });
  }, [fonts]);
  const missing = !!fonts && (!fonts.card || !fonts.tile);

  const page: Printable = { name: 'a4', svg: () => svg };
  const busy = !svg || missing || progress !== null;

  return (
    <div className="lab">
      <LabHeader page="proof" />
      <div className="lab-aid-page">
        {svg ? (
          <img className="lab-aid" style={{ aspectRatio: '210 / 297' }} src={dataUrl(svg)} alt="Press test" />
        ) : (
          <span className="lab-aid lab-aid-ph" style={{ aspectRatio: '210 / 297' }} />
        )}
        <div className="lab-aid-side">
          <p className="lab-note">
            Print it at 100 % (no fit to page) on the press and stock of the real run, from the same file the pieces will go as: the CMYK
            PDF for a service that wants CMYK, the PNG for one that converts RGB itself. Check that the ramp steps stay apart, the wells and
            nebula show, the text is clean and the colours tell apart.
          </p>
          <div className="lab-controls">
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => exportCmykPdf(PAGE, page))}>
              CMYK PDF · {PRESS.condition}
            </button>
            <button className="btn" disabled={busy} onClick={() => run(() => exportPng(PAGE, page, false))}>
              PNG (RGB)
            </button>
          </div>
          <p className="lab-note">A4, 210 × 297 mm, at {PAGE.dpi} dpi.</p>
          {missing && <p className="lab-note">The fonts didn’t load (offline?), so the export is off.</p>}
          {error && <p className="lab-error">Export failed: {error}</p>}
          {progress && (
            <p className="lab-progress">
              <span className="spinner" /> {progress}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
