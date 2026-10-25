/**
 * A self-play script's arguments, by name: given in order (`8 3 community`) or by name
 * (`--level=3`, `--seed=1`), in any mix; a named one doesn't take a place in the order. Unknown
 * names stop the script, so a typo isn't silently ignored.
 */
export function args<K extends string>(defaults: Record<K, string>, argv = process.argv.slice(2)): Record<K, string> {
  const names = Object.keys(defaults) as K[];
  const out = { ...defaults };
  const ordered: string[] = [];
  for (const a of argv) {
    const named = a.match(/^--([^=]+)=(.*)$/);
    if (!named) {
      if (a.startsWith('--')) throw new Error(`Give ${a} its value with =, as in ${a}=1`);
      ordered.push(a);
      continue;
    }
    if (!names.includes(named[1] as K)) throw new Error(`Unknown argument --${named[1]} (known: ${names.join(', ')})`);
    out[named[1] as K] = named[2];
  }
  const free = names.filter((k) => !argv.some((a) => a.startsWith(`--${k}=`)));
  if (ordered.length > free.length) throw new Error(`Too many arguments: ${ordered.slice(free.length).join(' ')}`);
  ordered.forEach((v, i) => (out[free[i]] = v));
  return out;
}
