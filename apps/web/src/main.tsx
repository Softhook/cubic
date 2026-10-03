import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Lab } from './lab/Lab';
import './styles.css';

// #lab opens the Art Lab instead of the game; switching between them reloads the page.
const lab = location.hash.startsWith('#lab');
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#lab') !== lab) location.reload();
});

// No StrictMode: its double-invoked effects would restart dice animations mid-tumble.
createRoot(document.getElementById('root')!).render(lab ? <Lab /> : <App />);
