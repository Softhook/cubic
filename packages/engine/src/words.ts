/**
 * A mode's own words for Quantum's (RuleSet.words): the engine, its log and the cards say "ship", "planet",
 * "conquer"…, and the UI shows them in the mode's words through `reword`. Keys are Quantum's words or phrases
 * in lower case, each inflection its own entry ("deploys", "deployed"); longer phrases win over the words in them.
 */
export type Words = Readonly<Record<string, string>>;

const patterns = new WeakMap<Words, RegExp>();

function patternOf(words: Words): RegExp {
  let re = patterns.get(words);
  if (!re) {
    const keys = Object.keys(words)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // A word's article comes with it, as the new word may need the other one: "a planet" → "an objective".
    re = new RegExp(`\\b(?:(an?) )?(${keys.join('|')})\\b`, 'gi');
    patterns.set(words, re);
  }
  return re;
}

/** `to` in the case `from` was written in: "Ship" → "Mech", "Warp Gate" → "Ice Tunnel", "ship" → "mech". */
function cased(from: string, to: string): string {
  if (from === from.toLowerCase()) return to;
  const title = from.split(' ').every((w) => /^[A-Z]/.test(w));
  return title && from.includes(' ') ? to.replace(/\b\w/g, (c) => c.toUpperCase()) : to.charAt(0).toUpperCase() + to.slice(1);
}

/**
 * `text` in a mode's words (unchanged without any). The `keep` strings are left as they are wherever they
 * appear: names players chose, which may well contain a word ("Planet Express"), or card names.
 */
export function reword(words: Words | undefined, text: string, keep: readonly string[] = []): string {
  if (!words) return text;
  const kept: string[] = [];
  let out = text;
  const uniqueKeep = [...new Set(keep)].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const k of uniqueKeep)
    if (out.includes(k)) {
      out = out.split(k).join(`\uE000${kept.length}\uE000`);
      kept.push(k);
    }
  out = out.replace(patternOf(words), (_, article: string | undefined, word: string) => {
    const to = cased(word, words[word.toLowerCase()]);
    if (!article) return to;
    const an = /^[aeiou]/i.test(to) ? 'an' : 'a';
    return `${article[0] === 'A' ? an[0].toUpperCase() + an.slice(1) : an} ${to}`;
  });
  return kept.length ? out.replace(/\uE000(\d+)\uE000/g, (_, i: string) => kept[Number(i)]) : out;
}
