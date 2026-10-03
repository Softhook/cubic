import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Lab } from './lab/Lab';
import { warmTileImages } from './art/tileImages';
import './styles.css';

// #lab opens the Art Lab instead of the game; switching between them reloads the page.
const lab = location.hash.startsWith('#lab');
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#lab') !== lab) location.reload();
});

// Draw the map tiles in the background while the player is in the lobby.
if (!lab) void warmTileImages();

// No StrictMode: its double-invoked effects would restart dice animations mid-tumble.
createRoot(document.getElementById('root')!).render(lab ? <Lab /> : <App />);
