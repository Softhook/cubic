import type { ReactNode } from 'react';

const PAGES = [
  { id: 'tiles', name: 'Tiles', href: '#lab' },
  { id: 'cards', name: 'Cards', href: '#lab/cards' },
];

/** The Art Lab's top bar: page tabs, the page's own controls, and the way back. */
export function LabHeader({ page, children }: { page: string; children?: ReactNode }) {
  return (
    <header className="lab-head">
      <h1>Art Lab</h1>
      <nav className="lab-tabs">
        {PAGES.map((p) => (
          <a key={p.id} href={p.href} className={p.id === page ? 'on' : ''}>{p.name}</a>
        ))}
        <a href="#rulebook">Manual</a>
      </nav>
      <div className="lab-head-controls">{children}</div>
      <a className="btn btn-ghost" href="#">Back to game</a>
    </header>
  );
}
