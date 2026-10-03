import { card } from '@quantum/engine';
import { CardView } from './Card';
import { Dialog } from './Dialog';

/** Shows a single card large, or a pile of cards grouped by name (so a deck's draw order stays hidden). */
export function CardViewer({ title, subtitle, cards, single, onClose }: {
  title: string;
  subtitle?: string;
  cards: string[];
  single?: boolean;
  onClose: () => void;
}) {
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  const ids = [...counts.keys()].sort((a, b) => card(a).name.localeCompare(card(b).name));

  return (
    <Dialog title={title} subtitle={subtitle} wide={!single} className="card-viewer" onClose={onClose}>
      <div className="card-choice wrap">
        {ids.map((id) => (
          <CardView key={id} id={id} size={single ? 'lg' : 'md'} badge={counts.get(id)! > 1 ? `×${counts.get(id)}` : undefined} />
        ))}
      </div>
    </Dialog>
  );
}
