import { Manual } from '../rulebook/Manual';
import css from '../rulebook/rulebook.css?raw';
import { Dialog } from './Dialog';

/** "How to play": the manual itself, the same one #rulebook prints. */
export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="How to play" wide className="manual-dialog" onClose={onClose}>
      <style>{css}</style>
      <p className="manual-print">
        {/* A new tab, so an online game in this one keeps its place. */}
        <a href="#rulebook" target="_blank" rel="noopener">Print or save as PDF ↗</a>
        <span>Undo (Ctrl/⌘+Z) takes back a misclick, unless dice were rolled or cards drawn.</span>
      </p>
      <Manual dark />
    </Dialog>
  );
}
