import { legalActions, type Action, type GameState } from '@quantum/engine';

type ActionOf<K extends Action['type']> = Extract<Action, { type: K }>;

/**
 * The legal actions of a state, indexed by type. The UI enables a button or highlights a space
 * only when a matching action is here, so it never re-implements a rule: whatever the engine
 * offers is clickable, and nothing else is.
 */
export interface Legal {
  of<K extends Action['type']>(type: K, where?: (a: ActionOf<K>) => boolean): ActionOf<K>[];
  can<K extends Action['type']>(type: K, where?: (a: ActionOf<K>) => boolean): boolean;
}

export function legalIndex(actions: Action[]): Legal {
  const byType = new Map<Action['type'], Action[]>();
  for (const a of actions) {
    const list = byType.get(a.type);
    if (list) list.push(a);
    else byType.set(a.type, [a]);
  }
  const of = <K extends Action['type']>(type: K, where?: (a: ActionOf<K>) => boolean): ActionOf<K>[] => {
    const list = (byType.get(type) ?? []) as ActionOf<K>[];
    return where ? list.filter(where) : list;
  };
  return {
    of,
    can: (type, where) => (where ? of(type).some(where) : (byType.get(type)?.length ?? 0) > 0),
  };
}

export const NO_LEGAL: Legal = legalIndex([]);

/** Every legal action, Flagship transports included. */
export function legalFor(game: GameState): Legal {
  return legalIndex(legalActions(game, { includeCarry: true }));
}
