import { useSyncExternalStore, type ReactNode } from 'react';
import { isOn, onSwitch, turn } from '../audio';

/** The top bar's switch for sound effects. */
export function SoundButton() {
  return (
    <Switch which="sound" name="sound effects">
      <path d="M2 6h2.5L8 3v10L4.5 10H2z" />
    </Switch>
  );
}

/** The top bar's switch for the music (ambience.ts). */
export function MusicButton() {
  return (
    <Switch which="music" name="music">
      <path d="M6 12V3.5l7-1.5v8.5" />
      <circle cx="4.25" cy="12" r="1.75" />
      <circle cx="11.25" cy="10.5" r="1.75" />
    </Switch>
  );
}

/** A speaker-style switch: `icon`, with a slash across it while off. */
function Switch({ which, name, children: icon }: { which: 'sound' | 'music'; name: string; children: ReactNode }) {
  const on = useSyncExternalStore(onSwitch, () => isOn(which));
  const label = `${on ? 'Turn off' : 'Turn on'} ${name}`;
  return (
    <button className="icon-btn" data-switch={which} title={label} aria-label={label} aria-pressed={on} onClick={() => turn(which, !on)}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
        {which === 'sound' && on && <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.5 6.5 0 0 1 0 9" />}
        {!on && <path d="M2 2l12 12" />}
      </svg>
    </button>
  );
}
