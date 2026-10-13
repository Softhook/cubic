import { Component, type ErrorInfo, type ReactNode } from 'react';
import { markGameOnScreen } from '../game/savedGame';

/**
 * Catches a crash anywhere below it (a render error, or a part of the app that failed to load) and
 * offers a way out instead of a blank page. Reload brings back the game that was on screen (it is
 * saved after every move); if that game is what crashes, the lobby still offers to resume it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[quantum] the app crashed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h2>Something went wrong</h2>
        <p className="crash-detail">{error.message}</p>
        <p className="crash-hint">The details are in the browser console.</p>
        <div className="crash-actions">
          <button className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
          <button className="btn" onClick={toLobby}>Back to the lobby</button>
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
