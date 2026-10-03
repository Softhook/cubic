import { useEffect, useState } from 'react';
import { CardLab } from './CardLab';
import { TileLab } from './TileLab';

/** Art Lab (open with #lab): print artwork for tiles (#lab) and cards (#lab/cards). See docs/GRAPHICS.md. */
export function Lab() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash.startsWith('#lab/cards') ? <CardLab /> : <TileLab />;
}
