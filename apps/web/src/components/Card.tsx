import { card, cardKind, effectOf, isOriginalCard } from '@quantum/engine';

const CATEGORY_LABEL: Record<string, string> = {
  movement: 'Movement',
  action: 'Action',
  combat: 'Combat',
  conquer: 'Conquer',
  research: 'Research',
  ship: 'Ship',
  card: 'Cards',
};

export function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (category) {
    case 'movement':
      return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case 'action':
      return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>;
    case 'combat':
      return <svg {...p}><circle cx="12" cy="12" r="7" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></svg>;
    case 'conquer':
      return <svg {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>;
    case 'research':
      return <svg {...p}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></svg>;
    case 'ship':
      return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /></svg>;
    case 'card':
      return <svg {...p}><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M3 7v12a2 2 0 0 0 2 2" /></svg>;
    case 'tactic':
      return <svg {...p}><path d="M12 2 3 7l9 5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" /></svg>;
    case 'expansion':
      return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    default:
      return null;
  }
}

export interface CardViewProps {
  id: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
  inactive?: boolean;
  className?: string;
}

export function CardView({ id, size = 'md', onClick, disabled, badge, inactive, className = '' }: CardViewProps) {
  const def = card(id);
  const original = isOriginalCard(id);
  // The original Expansion is a Gambit card but looks like the CE Expansion card.
  const kind = effectOf(id) === 'expansion' ? 'expansion' : cardKind(id);
  const category = kind === 'skill' ? def.category ?? 'card' : kind;
  const kindLabel = kind === 'expansion' ? (original ? 'Gambit' : 'Expansion') : original ? 'Gambit' : 'Tactic';
  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      className={`qcard qcard-${kind} qcard-${size} cat-${category} ${def.text.length > 110 ? 'long' : ''} ${clickable ? 'clickable' : ''} ${inactive ? 'inactive' : ''} ${className}`}
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={`${def.name} — ${def.text}`}
    >
      <div className="qcard-top">
        <span className="qcard-cat">
          <CategoryIcon category={category} size={size === 'sm' ? 11 : 13} />
          {kind === 'skill' ? CATEGORY_LABEL[category] ?? 'Skill' : kindLabel}
        </span>
        {badge && <span className="qcard-badge">{badge}</span>}
      </div>
      <div className="qcard-name">{def.name}</div>
      <div className="qcard-sub">{def.subtitle}</div>
      <div className="qcard-text">{def.text}</div>
    </button>
  );
}
