import { useEffect, useMemo, useState } from 'react';
import { playerAidSvg, type AidEdition } from '@quantum/art';
import { cardFontCss, measure } from './cards';
import { PIECES, type Printable } from '../print/pieces';
import { PrintPanel } from '../print/PrintPanel';
import { LabHeader } from './LabHeader';
import { Segmented } from '../components/Segmented';

/** How many boards "All copies" prints: one per player, for the largest player count. */
const PLAYERS = 4;

/**
 * Art Lab, player aid page (#lab/aid): the A6 board every player gets, with the dominance and research
 * die pads, the turn, and what each ship can do. Exports for print: the board, and print sheets (two
 * to a page).
 */
export function AidLab() {
  const [edition, setEdition] = useState<AidEdition>('community');
  const [bleed, setBleed] = useState(true);
  const [fonts, setFonts] = useState<string | null>(null);

  useEffect(() => {
    void cardFontCss().then(setFonts);
  }, []);

  const svgOf = (o: { bleed?: boolean; rounded?: boolean } = {}) => playerAidSvg({ ...o, edition, measure, fontCss: fonts ?? '' });
  const detail = useMemo(() => (fonts === null ? '' : URL.createObjectURL(new Blob([svgOf({ bleed, rounded: !bleed })], { type: 'image/svg+xml' }))), [bleed, fonts, edition]);
  useEffect(() => () => URL.revokeObjectURL(detail), [detail]);

  const board: Printable = { name: edition, svg: (b) => svgOf({ bleed: b }) };
  const part = edition === 'community' ? 'Community' : 'Classic';

  return (
    <div className="lab">
      <LabHeader page="aid">
        <Segmented<AidEdition> small options={[['community', 'Community'], ['classic', 'Classic']]} value={edition} onPick={setEdition} />
      </LabHeader>
      <div className="lab-aid-page">
        {detail ? <img className="lab-aid" src={detail} alt="Player aid" /> : <span className="lab-aid lab-aid-ph" />}
        <div className="lab-aid-side">
          <p className="lab-note">
            One board per player · A6 landscape, 148 × 105 mm · pads for the 19 mm dominance and research dice ·{' '}
            {part === 'Classic' ? 'Classic rules (no missiles; Reconfigure to any new value)' : 'Community Edition rules'}
          </p>
          <PrintPanel
            piece={PIECES.aid}
            item={board}
            bleed={bleed}
            onBleed={setBleed}
            set={[board]}
            part={part}
            notes={`The same board for every player: print one each (${PLAYERS} for a full table).\n`}
            sheets={(copies) => Array(copies ? PLAYERS : 1).fill({ front: board })}
            copies
            ready={fonts !== null}
          />
        </div>
      </div>
    </div>
  );
}
