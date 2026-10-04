import type { CSSProperties } from 'react';
import { CARD_CATEGORIES, ICONS, cardPalette } from '@quantum/art';
import { card, cardKind, effectOf, isOriginalCard } from '@quantum/engine';

/** A card category's icon (the same drawing as on the printed cards). */
export function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
  const markup = ICONS[category];
  if (!markup) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: markup }} />
  );
}

/** Sets `--cat` to a category's accent colour, as printed on a light (permanent) or dark (one-shot) card. */
export const categoryStyle = (category: string, light: boolean) =>
  ({ '--cat': cardPalette(light, CARD_CATEGORIES[category]?.hue ?? CARD_CATEGORIES.action.hue).accent }) as CSSProperties;

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
  const kindLabel = kind === 'expansion' ? (original ? 'Gambit' : 'Expansion') : original ? 'Gambit' : 'Tactic';
  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      className={`qcard qcard-${kind} qcard-${size} ${def.text.length > 110 ? 'long' : ''} ${clickable ? 'clickable' : ''} ${inactive ? 'inactive' : ''} ${className}`}
      style={categoryStyle(def.category, kind === 'skill')}
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={`${def.name} — ${def.text}`}
    >
      <div className="qcard-top">
        <span className="qcard-cat">
          <CategoryIcon category={def.category} size={size === 'sm' ? 11 : 13} />
          {kind === 'skill' ? CARD_CATEGORIES[def.category]?.label ?? 'Skill' : kindLabel}
        </span>
        {badge && <span className="qcard-badge">{badge}</span>}
      </div>
      <div className="qcard-name">{def.name}</div>
      <div className="qcard-sub">{def.subtitle}</div>
      <div className="qcard-text">{def.text}</div>
    </button>
  );
}
