/**
 * Finds public Nostr relays that would carry online games, and checks the ones we use.
 *
 *   npm run relays:check                       # our relays plus the best candidates
 *   npm run relays:check -- wss://a wss://b    # just these
 *   npm run relays:check -- --recheck          # do they still hold what the last check sent?
 *
 * Candidates come from relay monitors (NIP-66 reports, one query) and are filtered on what they
 * say about themselves (NIP-11: no payment, login or proof of work). Each is then sent a few
 * game-like events and asked for them back. It is gentle on purpose: relays ban an IP address
 * for bursts (damus.io did, while the first list was made), so each relay gets one connection,
 * a few events seconds apart, and nothing more after its first refusal.
 *
 * What was sent is kept in scripts/.relay-check.json; `--recheck` a few days later shows which
 * relays keep events (it only reads). The output is a suggestion: edit RELAYS in
 * apps/web/src/online/relays.ts by hand, and keep a dropped relay readable for a while so games
 * in progress still find their history there.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { finalizeEvent, generateSecretKey, type Event as NostrEvent } from 'nostr-tools/pure';
import { Relay } from 'nostr-tools/relay';
import { RELAYS } from '../apps/web/src/online/relays';
import { hex, KIND } from '../packages/online/src';

/** Relays that publish NIP-66 monitor reports, tried in turn. */
const MONITORS = ['wss://relay.nostr.watch', 'wss://relaypag.es', 'wss://monitorlizard.nostr1.com'];
/** Known not to suit us (see the comment on RELAYS); not worth a connection. */
const SKIP = /damus\.io|oxtr\.dev|nostr\.wine|nostr\.land|offchain\.pub/;
/** How many candidates to test besides our own relays, fastest first. */
const MAX_CANDIDATES = 12;
/** Events sent to each relay, and the pause between them. */
const EVENTS = 3;
const GAP_MS = 3000;
/** Relays tested at once (each a different host, so no relay sees more than one connection). */
const PARALLEL = 4;
const TIMEOUT_MS = 10000;
const STATE = new URL('./.relay-check.json', import.meta.url);

interface Sent {
  at: number;
  tag: string;
  /** Per relay: ids of the events it accepted. */
  accepted: Record<string, string[]>;
}

interface Result {
  url: string;
  rtt?: number;
  info: string;
  accepted: number;
  readBack: number;
  refusal?: string;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const norm = (url: string) => url.replace(/\/+$/, '').toLowerCase();

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return Promise.race([p, sleep(TIMEOUT_MS).then(() => Promise.reject(new Error(`${what} timed out`)))]);
}

/** Relays the monitors saw in the last day that ask for no login, payment or proof of work, with their connect time. */
async function candidates(): Promise<Map<string, number>> {
  for (const url of MONITORS) {
    try {
      const r = await withTimeout(Relay.connect(url), 'connect');
      const found = new Map<string, number>();
      await new Promise<void>((done) => {
        const sub = r.subscribe([{ kinds: [30166], since: Math.floor(Date.now() / 1000) - 86400, limit: 1000 }], {
          onevent(e) {
            const tag = (name: string) => e.tags.filter((t) => t[0] === name).map((t) => t[1]);
            const relay = tag('d')[0];
            const rules = new Set(tag('R'));
            const open = ['!auth', '!payment', '!pow'].every((x) => rules.has(x)) && tag('n').includes('clearnet');
            if (relay?.startsWith('wss://') && open) found.set(norm(relay), Number(tag('rtt-open')[0]) || Infinity);
          },
          oneose() {
            sub.close();
            done();
          },
          eoseTimeout: 20000,
        });
      });
      r.close();
      if (found.size) return found;
    } catch (e) {
      console.warn(`monitor ${url}: ${(e as Error).message}`);
    }
  }
  return new Map();
}

/** What the relay says about itself (NIP-11), in a few words; `bad` if it rules us out. */
async function info(url: string): Promise<{ text: string; bad: boolean }> {
  try {
    const res = await fetch(url.replace(/^ws/, 'http'), { headers: { Accept: 'application/nostr+json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const j = (await res.json()) as { limitation?: Record<string, unknown>; software?: string; retention?: unknown };
    const l = j.limitation ?? {};
    const flags = (['payment_required', 'auth_required', 'restricted_writes'] as const).filter((k) => l[k]);
    if (Number(l.min_pow_difficulty) > 0) flags.push('pow' as never);
    const software = j.software?.split('/').pop()?.replace(/\.git$/, '') ?? '?';
    return { text: [software, ...flags, j.retention ? 'retention' : ''].filter(Boolean).join(' '), bad: flags.length > 0 };
  } catch {
    return { text: 'no NIP-11', bad: false };
  }
}

/** A game-like event: our kind, a random `d`, the test's tag and an opaque blob of a move's size. */
function testEvent(sk: Uint8Array, tag: string): NostrEvent {
  const blob = Buffer.from(crypto.getRandomValues(new Uint8Array(200))).toString('base64url');
  const d = Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('base64url');
  return finalizeEvent({ kind: KIND, created_at: Math.floor(Date.now() / 1000), tags: [['d', d], ['t', tag]], content: blob }, sk);
}

/** The ids of our events the relay returns for the tag. */
async function fetchIds(r: Relay, tag: string): Promise<Set<string>> {
  const ids = new Set<string>();
  await new Promise<void>((done) => {
    const sub = r.subscribe([{ kinds: [KIND], '#t': [tag], limit: 50 }], {
      onevent: (e) => void ids.add(e.id),
      oneose() {
        sub.close();
        done();
      },
      onclose: () => done(),
      eoseTimeout: TIMEOUT_MS,
    });
  });
  return ids;
}

async function test(url: string, sk: Uint8Array, tag: string, rtt: number | undefined, sent: Sent): Promise<Result> {
  const nip11 = await info(url);
  const result: Result = { url, rtt, info: nip11.text, accepted: 0, readBack: 0 };
  if (nip11.bad) return { ...result, refusal: 'rules us out (NIP-11)' };
  let r: Relay | undefined;
  try {
    r = await withTimeout(Relay.connect(url), 'connect');
    const ok: string[] = [];
    for (let i = 0; i < EVENTS; i++) {
      if (i) await sleep(GAP_MS);
      const e = testEvent(sk, tag);
      try {
        await withTimeout(r.publish(e), 'publish');
        ok.push(e.id);
      } catch (err) {
        result.refusal = String((err as Error).message ?? err).slice(0, 60);
        break;
      }
    }
    result.accepted = ok.length;
    sent.accepted[url] = ok;
    if (ok.length) {
      await sleep(1000);
      const back = await fetchIds(r, tag);
      result.readBack = ok.filter((id) => back.has(id)).length;
    }
  } catch (err) {
    result.refusal ??= String((err as Error).message ?? err).slice(0, 60);
  } finally {
    r?.close();
  }
  return result;
}

async function check(urls: string[], rtts: Map<string, number>) {
  const sk = generateSecretKey();
  const tag = hex(crypto.getRandomValues(new Uint8Array(16)));
  const sent: Sent = { at: Date.now(), tag, accepted: {} };
  const results: Result[] = [];
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let url; (url = queue.shift()); ) {
        const res = await test(url, sk, tag, rtts.get(url), sent);
        results.push(res);
        console.log(`  ${verdict(res)} ${url}`);
      }
    }),
  );
  writeFileSync(STATE, JSON.stringify(sent, null, 2));
  const ours = new Set(RELAYS.map(norm));
  results.sort((a, b) => +(verdict(b) === '✓') - +(verdict(a) === '✓') || (a.rtt ?? Infinity) - (b.rtt ?? Infinity));
  console.log('\n   relay                                     ms  sent  back  notes');
  for (const res of results) {
    const rtt = res.rtt && Number.isFinite(res.rtt) ? String(res.rtt) : '';
    const notes = [ours.has(res.url) ? '(ours)' : '', res.info, res.refusal ?? ''].filter(Boolean).join(' · ');
    console.log(` ${verdict(res)} ${res.url.padEnd(40)} ${rtt.padStart(5)}  ${res.accepted}/${EVENTS}   ${res.readBack}/${res.accepted}   ${notes}`);
  }
  console.log(`\nRun with --recheck in a few days to see which relays keep events.`);
}

function verdict(r: Result): string {
  return r.accepted === EVENTS && r.readBack === EVENTS ? '✓' : r.accepted ? '~' : '✗';
}

async function recheck() {
  let sent: Sent;
  try {
    sent = JSON.parse(readFileSync(STATE, 'utf8')) as Sent;
  } catch {
    return console.error('No earlier check to compare with: run without --recheck first.');
  }
  const days = ((Date.now() - sent.at) / 86400000).toFixed(1);
  console.log(`Events sent ${days} days ago; which relays still hold them:\n`);
  const queue = Object.entries(sent.accepted).filter(([, ids]) => ids.length);
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let item; (item = queue.shift()); ) {
        const [url, ids] = item;
        try {
          const r = await withTimeout(Relay.connect(url), 'connect');
          const back = await fetchIds(r, sent.tag);
          r.close();
          const kept = ids.filter((id) => back.has(id)).length;
          console.log(` ${kept === ids.length ? '✓' : kept ? '~' : '✗'} ${url.padEnd(40)} ${kept}/${ids.length}`);
        } catch (e) {
          console.log(` ? ${url.padEnd(40)} ${(e as Error).message}`);
        }
      }
    }),
  );
}

const args = process.argv.slice(2);
if (args.includes('--recheck')) {
  await recheck();
} else {
  const given = args.filter((a) => a.startsWith('wss://')).map(norm);
  let rtts = new Map<string, number>();
  let urls = given;
  if (!given.length) {
    rtts = await candidates();
    const ours = RELAYS.map(norm);
    const best = [...rtts.entries()]
      .filter(([url]) => !ours.includes(url) && !SKIP.test(url))
      .sort((a, b) => a[1] - b[1])
      .slice(0, MAX_CANDIDATES)
      .map(([url]) => url);
    console.log(`Monitors list ${rtts.size} open relays; testing ours and the ${best.length} fastest others.\n`);
    urls = [...ours, ...best];
  }
  await check(urls, rtts);
}
process.exit(0);
