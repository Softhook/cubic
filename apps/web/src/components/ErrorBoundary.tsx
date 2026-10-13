import { Component, type ErrorInfo, type ReactNode } from 'react';
import { markGameOnScreen, savedGameJson } from '../game/savedGame';

interface State {
  /** Set once anything below has thrown. JavaScript can throw any value (null included), so it is boxed. */
  crash: { error: unknown } | null;
}

/**
 * Catches a crash anywhere below it (a render error, or a part of the app that failed to load) and
 * offers a way out instead of a blank page. Reload brings back the game that was on screen (it is
 * saved after every move); if that game is what crashes, the lobby still offers to resume it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { crash: null };

  static getDerivedStateFromError(error: unknown): State {
    return { crash: { error } };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // The last saved position of a local game: the crash can be replayed from it.
    console.error('[quantum] the app crashed', { error, componentStack: info.componentStack, savedGame: savedGameJson() });
  }

  render() {
    const { crash } = this.state;
    if (!crash) return this.props.children;
    const { error } = crash;
    return (
      <div className="crash" role="alert">
        <h2>Something went wrong</h2>
        <p className="crash-detail">{error instanceof Error ? error.message : String(error)}</p>
        <p className="crash-hint">The details are in the browser console.</p>
        <div className="crash-actions">
          <button className="btn btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
          <button className="btn" onClick={toLobby}>
            Back to the lobby
          </button>
        </div>
      </div>
    );
  }
}

function toLobby() {
  markGameOnScreen(false);
  // Without the hash (an online game, the lab) or the query (the dev server's ?play= link restarts a game).
  history.replaceState(null, '', location.pathname);
  location.reload();
}
