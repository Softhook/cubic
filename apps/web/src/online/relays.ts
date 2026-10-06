import { Relay } from 'nostr-tools/relay';
import { KIND, type NostrEvent } from '@quantum/online';

/**
 * Public Nostr relays that store our events. Checked 2026-10 with a new key: each took a burst of
 * 40 events and returned them all. Left out: relays that want payment, a NIP-05 address or a "web
 * of trust" (nostr.wine, nostr.land, offchain.pub…), and ones with tight rate limits (damus.io,
 * nostr.oxtr.dev). A game is sent to all of them, so it survives any one going away; every browser
 * also keeps the whole game and re-sends whatever a relay is missing.
 */
export const RELAYS = [
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://relay.snort.social',
  'wss://relay.nostr.net',
  'wss://nostr-pub.wellorder.net',
  'wss://nostr.data.haus',
];

const RETRY_MS = [2000, 5000, 15000, 30000];
/** A relay that doesn't answer within this long counts as down (and is retried later). */
const CONNECT_TIMEOUT_MS = 8000;
/** Gap between two events sent to the same relay, so a burst of moves doesn't trip rate limits. */
const SEND_GAP_MS = 150;
/** Pause after a relay says we are sending too fast. */
const RATE_LIMIT_PAUSE_MS = 30000;
/** Refusals that won't change by trying again: stop writing to that relay. */
const REFUSED_FOR_GOOD = /blocked|restricted|web of trust|pay|auth-required|nip-05|whitelist|not allowed/i;
const RATE_LIMITED = /rate.?limit|too (many|fast)|slow down/i;
/** Relays answer a query with at most a few hundred events; older ones are fetched page by page. */
const PAGE = 500;

export interface RelayStatus {
  connected: number;
  total: number;
}

/**
 * One game's connection to the relays: receives every event filed under the game's tag (the
 * stored ones, then new ones as they are posted), publishes this browser's events, and re-sends
 * known events a relay doesn't have.
 */
export class RelayLink {
  private relays = new Map<string, Relay>();
  /** Relays with a connection attempt under way; a second one would leak a socket. */
  private connecting = new Set<string>();
  private seen = new Map<string, Set<string>>();
  /** Events waiting to be sent, per relay, oldest first. */
  private outbox = new Map<string, NostrEvent[]>();
  private sending = new Set<string>();
  /** Relays that refused our events for good; still read from. */
  private readOnly = new Set<string>();
  private closed = false;
  private timers = new Set<number>();

  constructor(
    private tag: string,
    /** Every event this browser holds for the game. */
    private known: () => NostrEvent[],
    private onEvent: (e: NostrEvent) => void,
    private onStatus: (s: RelayStatus) => void,
  ) {}

  start() {
    for (const url of RELAYS) void this.connect(url, 0);
    // A phone that slept drops its sockets; reconnect as soon as the page is visible again.
    document.addEventListener('visibilitychange', this.wake);
  }

  close() {
    this.closed = true;
    document.removeEventListener('visibilitychange', this.wake);
    for (const t of this.timers) window.clearTimeout(t);
    const relays = [...this.relays.values()];
    this.relays.clear();
    // End the subscriptions first and close the sockets a moment later: nostr-tools sends a
    // subscription's CLOSE message asynchronously, after a socket closed at once has gone, and
    // the browser logs an error for each.
    for (const r of relays) for (const sub of [...r.openSubs.values()]) sub.close();
    window.setTimeout(() => relays.forEach((r) => r.close()), 0);
  }

  publish(e: NostrEvent) {
    for (const url of RELAYS) this.enqueue(url, [e]);
  }

  private wake = () => {
    if (document.visibilityState !== 'visible') return;
    for (const url of RELAYS) if (!this.relays.get(url)?.connected) void this.connect(url, 0);
  };

  private status() {
    const writable = [...this.relays].filter(([url, r]) => r.connected && !this.readOnly.has(url)).length;
    this.onStatus({ connected: writable, total: RELAYS.length });
  }

  private later(fn: () => void, ms: number) {
    const t = window.setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private async connect(url: string, attempt: number) {
    if (this.closed || this.connecting.has(url)) return;
    const old = this.relays.get(url);
    if (old?.connected) return;
    old?.close();
    this.relays.delete(url);
    this.connecting.add(url);
    let r: Relay;
    try {
      // Pings notice a connection that died quietly (a phone changing network), so it is reopened.
      r = await Relay.connect(url, { enablePing: true, timeout: CONNECT_TIMEOUT_MS });
    } catch {
      this.later(() => void this.connect(url, attempt + 1), RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]);
      return;
    } finally {
      this.connecting.delete(url);
    }
    if (this.closed) return r.close();
    this.relays.set(url, r);
    this.status();
    this.drain(url);
    r.onclose = () => {
      if (this.relays.get(url) !== r) return;
      this.relays.delete(url);
      this.status();
      this.later(() => void this.connect(url, 1), RETRY_MS[0]);
    };
    const seen = this.seen.get(url) ?? new Set<string>();
    this.seen.set(url, seen);
    const got = (e: NostrEvent) => {
      seen.add(e.id);
      this.onEvent(e);
    };
    // The newest events, then every new one as it is posted.
    let oldest = Infinity;
    let count = 0;
    r.subscribe([{ kinds: [KIND], '#t': [this.tag], limit: PAGE }], {
      onevent: (e) => {
        count++;
        oldest = Math.min(oldest, e.created_at);
        got(e);
      },
      oneose: () => void this.backfill(url, r, count, oldest).then(() => this.resend(url)),
    });
  }

  /** Fetches older pages until one brings nothing new. */
  private async backfill(url: string, r: Relay, count: number, oldest: number) {
    const seen = this.seen.get(url)!;
    while (count >= 50 && Number.isFinite(oldest) && !this.closed) {
      const before = seen.size;
      let next = Infinity;
      count = 0;
      await new Promise<void>((done) => {
        const sub = r.subscribe([{ kinds: [KIND], '#t': [this.tag], until: oldest, limit: PAGE }], {
          onevent: (e) => {
            count++;
            next = Math.min(next, e.created_at);
            seen.add(e.id);
            this.onEvent(e);
          },
          oneose: () => {
            sub.close();
            done();
          },
          onclose: () => done(),
        });
      });
      if (seen.size === before) break;
      oldest = next;
    }
  }

  /** Queues every event the relay didn't return. */
  private resend(url: string) {
    const seen = this.seen.get(url)!;
    this.enqueue(url, this.known().filter((e) => !seen.has(e.id)));
  }

  private enqueue(url: string, events: NostrEvent[]) {
    if (this.readOnly.has(url) || !events.length) return;
    const q = this.outbox.get(url) ?? [];
    const queued = new Set(q.map((e) => e.id));
    q.push(...events.filter((e) => !queued.has(e.id) && !this.seen.get(url)?.has(e.id)));
    this.outbox.set(url, q);
    this.drain(url);
  }

  /** Sends a relay its queued events one at a time, pausing when it asks us to slow down. */
  private drain(url: string) {
    const r = this.relays.get(url);
    const q = this.outbox.get(url);
    if (this.closed || !r?.connected || !q?.length || this.sending.has(url) || this.readOnly.has(url)) return;
    this.sending.add(url);
    const e = q[0];
    const next = (ms: number) => {
      this.sending.delete(url);
      this.later(() => this.drain(url), ms);
    };
    r.publish(e).then(
      () => {
        this.seen.get(url)?.add(e.id);
        q.shift();
        next(SEND_GAP_MS);
      },
      (err: unknown) => {
        const why = String((err as Error)?.message ?? err);
        if (REFUSED_FOR_GOOD.test(why)) {
          console.warn(`[quantum] ${url} refuses our events (${why}); reading from it only`);
          this.readOnly.add(url);
          this.outbox.delete(url);
          this.sending.delete(url);
          this.status();
        } else if (RATE_LIMITED.test(why)) {
          next(RATE_LIMIT_PAUSE_MS);
        } else {
          // Anything else (a timeout, a hiccup): skip it; the next sync re-sends what is missing.
          q.shift();
          next(SEND_GAP_MS);
        }
      },
    );
  }
}
