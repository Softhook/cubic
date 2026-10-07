import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Lab } from './lab/Lab';
import { Rulebook } from './rulebook/Rulebook';
import { warmTileImages } from './art/tileImages';
import { startServiceWorker } from './pwa';
import './styles.css';

// #lab opens the Art Lab and #rulebook the printable rules instead of the game; switching between
// them reloads the page.
const pageOf = (hash: string) => (hash.startsWith('#lab') ? 'lab' : hash.startsWith('#rulebook') ? 'rulebook' : 'game');
const page = pageOf(location.hash);
window.addEventListener('hashchange', () => {
  if (pageOf(location.hash) !== page) location.reload();
});

// Draw the map tiles in the background while the player is in the lobby.
if (page === 'game') void warmTileImages();

// Production builds only: in dev it would cache what the dev server serves.
if (import.meta.env.PROD) startServiceWorker();

// No StrictMode: its double-invoked effects would restart dice animations mid-tumble.
createRoot(document.getElementById('root')!).render(page === 'lab' ? <Lab /> : page === 'rulebook' ? <Rulebook /> : <App />);
