import { useEffect, useState } from 'react';
import { cardBackImage, cardImage, cardImageNow } from './cardImages';

const DRAW = { front: cardImage, back: cardBackImage };
const NOW = { front: cardImageNow, back: () => undefined };

/**
 * A card image drawn on demand (cardImages.ts): at once if it's drawn already, else undefined till it is. A failed
 * drawing leaves it undefined, so the caller's placeholder stays.
 */
function useDrawn(side: 'front' | 'back', id: string): string | undefined {
  const [src, setSrc] = useState(() => NOW[side](id));
  useEffect(() => {
    let live = true;
    setSrc(NOW[side](id));
    DRAW[side](id).then(
      (url) => live && setSrc(url),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [side, id]);
  return src;
}

/** Card `id`'s printed front. */
export const useCardImage = (id: string) => useDrawn('front', id);

/** The printed back of the deck card `id` belongs to. */
export const useCardBack = (id: string) => useDrawn('back', id);
