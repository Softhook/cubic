import { setMoonMaps, useMoonMaps } from '../art/mapLook';
import { Switch } from './SoundButton';

/** The top bar's switch, on a hex map, between the moon tiles and the original space ones. */
export function MoonButton() {
  const on = useMoonMaps();
  return (
    <Switch which="moon" label={on ? 'Show the original space tiles' : 'Show the moon tiles'} on={on} onToggle={() => setMoonMaps(!on)}>
      <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />
    </Switch>
  );
}
