import { useRef, useState } from 'react';
import { download } from '../files';
import { PAPER, type Paper } from '../print/sheets';
import { Manual } from './Manual';
import css from './rulebook.css?raw';

/**
 * The printable manual (#rulebook): the same <Manual> as the in-game "How to play" dialog, on paper.
 * "Save as PDF" prints the page; "Download HTML" saves it as one self-contained file.
 */

/** The game's colour variables (styles.css :root) the manual uses, read off its stylesheet; the downloaded file gets a copy. */
const GAME_VARS = [...new Set(css.match(/var\(--(?!mn-)[\w-]+/g)!.map((v) => v.slice(4)))];

function gameColours() {
  const root = getComputedStyle(document.documentElement);
  return `:root{${GAME_VARS.map((v) => `${v}:${root.getPropertyValue(v).trim()}`).join(';')}}`;
}

/** Where "Back" goes: the Art Lab page that opened the manual (#rulebook?from=lab/cards), else the game. */
function backLink() {
  const from = new URLSearchParams(location.hash.split('?')[1]).get('from');
  return from?.startsWith('lab') ? { href: `#${from}`, label: 'Back to Art Lab' } : { href: '#', label: 'Back to game' };
}

export function Rulebook() {
  const back = backLink();
  const page = useRef<HTMLDivElement>(null);
  const [paper, setPaper] = useState<Paper>('a4');
  // After rulebook.css, so it replaces the stylesheet's A4.
  const pageCss = `@media print { @page { size: ${PAPER[paper].w}mm ${PAPER[paper].h}mm; } }`;

  const downloadHtml = () => {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cubic — Manual</title><style>${gameColours()}${css}${pageCss}</style></head><body class="rb-standalone">${page.current!.outerHTML}</body></html>`;
    download('cubic-manual.html', new Blob([html], { type: 'text/html' }));
  };

  return (
    <div className="rb-screen">
      <style>{css + pageCss}</style>
      <div className="rb-toolbar">
        <a className="btn btn-ghost" href={back.href}>← {back.label}</a>
        <span className="rb-spacer" />
        <select value={paper} onChange={(e) => setPaper(e.target.value as Paper)} aria-label="Paper">
          {Object.entries(PAPER).map(([id, p]) => (
            <option key={id} value={id}>{p.name}</option>
          ))}
        </select>
        <button className="btn" onClick={downloadHtml}>Download HTML</button>
        <button className="btn btn-primary" onClick={() => window.print()}>Save as PDF</button>
      </div>

      <div className="rb-page" ref={page}>
        <Manual />
      </div>
    </div>
  );
}
