import { createContext, useContext } from 'react';

/** How the screen words a text: in the game's words (the engine's `say`) inside a game (GameScreen), as written outside one. */
export const SayContext = createContext<(text: string) => string>((text) => text);

export const useSay = () => useContext(SayContext);
