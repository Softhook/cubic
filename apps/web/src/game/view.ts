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
  /** On this device: an AI is about to fire a missile or re-roll in the battle on screen. */
  aiResponding?: boolean;
  /**
   * Online only: a battle waits for the players who may respond to say they are done, and once
   * decided stays on screen until dismissed.
   */
  combat?: {
    /** This browser's seats that may still respond. */
    responders: PlayerId[];
    /** Whether the battle waits for this browser. */
    mustAnswer: boolean;
    /** Other players the battle waits for. */
    waitingOn: PlayerId[];
    pass(): void;
    /** Moves on from the battle once it has been decided. */
    dismiss(): void;
  };
}
