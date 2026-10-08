import { useEffect, useState } from 'react';
import { AidLab } from './AidLab';
import { CardLab } from './CardLab';
import { TileLab } from './TileLab';

/** Art Lab (open with #lab): print artwork for tiles (#lab), cards (#lab/cards) and the player aid (#lab/aid). See docs/GRAPHICS.md. */
export function Lab() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  if (hash.startsWith('#lab/cards')) return <CardLab />;
  if (hash.startsWith('#lab/aid')) return <AidLab />;
  return <TileLab />;
}
