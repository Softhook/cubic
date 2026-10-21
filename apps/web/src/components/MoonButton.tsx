import { setMoonMaps, useMoonMaps } from '../art/mapLook';

/** The top bar's switch, on a hex map, between the moon tiles and the original space ones. */
export function MoonButton() {
  const on = useMoonMaps();
  const label = on ? 'Show the original space tiles' : 'Show the moon tiles';
  return (
    <button className="icon-btn" data-switch="moon" title={label} aria-label={label} aria-pressed={on} onClick={() => setMoonMaps(!on)}>
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
        <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />
        {!on && <path d="M2 2l12 12" />}
      </svg>
    </button>
  );
}
