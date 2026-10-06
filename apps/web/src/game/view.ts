import type { GameState, PlayerId } from '@quantum/engine';
import type { Toast } from './toasts';
import type { Dispatch } from './useGame';

/**
 * A game as the screen sees it, whether it is played on this device (useGame) or online
 * (useOnlineGame). Board, panels and overlays render it and don't care which it is.
 */
export interface GameView {
  game: GameState;
  dispatch: Dispatch;
  /** Whether this screen plays for `p` (on this device: every human; online: this browser's seats). */
  mine(p: PlayerId): boolean;
  undo?: () => void;
  toasts: Toast[];
  error: { id: number; text: string } | null;
  /** Online only: a battle waits for the players who may respond to say they are done. */
  combat?: {
    /** This browser's seats that may still respond. */
    responders: PlayerId[];
    /** Whether the battle waits for this browser. */
    mustAnswer: boolean;
    /** Other players the battle waits for. */
    waitingOn: PlayerId[];
    pass(): void;
  };
}
