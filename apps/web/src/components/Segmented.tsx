import type { ReactNode } from 'react';

/** A segmented control: one button per `[value, label]` option, the one for `value` pressed. */
export function Segmented<T extends string | number | boolean>({
  options,
  value,
  onPick,
  small,
  label,
}: {
  options: readonly (readonly [T, ReactNode])[];
  value: T;
  onPick: (v: T) => void;
  small?: boolean;
  label?: string;
}) {
  return (
    <div className={`segmented${small ? ' small' : ''}`} role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button type="button" key={String(v)} className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onPick(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
