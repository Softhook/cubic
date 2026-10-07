import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;

/** This build: its commit (`dev` on the dev server) and when it was made. Shown in the lobby. */
export const BUILD = { id: __BUILD_ID__, time: new Date(__BUILD_TIME__) };

/**
 * Where updates stand, for the lobby's version line. `off`: no service worker (the dev server, or a
 * browser without one). `current` and `failed` only follow a check the player asked for.
 */
export type UpdateStatus = 'off' | 'idle' | 'checking' | 'current' | 'updating' | 'ready' | 'offline' | 'failed';

let status: UpdateStatus = 'off';
const listeners = new Set<() => void>();
function setStatus(s: UpdateStatus) {
  status = s;
  listeners.forEach((l) => l());
}

export function useUpdateStatus(): UpdateStatus {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => status,
  );
}

let checkNow: (asked: boolean) => void = () => {};
let applyNow = () => {};

/** The lobby's button: look for a new version and, if there is one, switch to it straight away. */
export function checkForUpdate() {
  if (status === 'ready') applyNow();
  else checkNow(true);
}

/** While the app stays on screen (a desktop tab), it still looks for a new version this often. */
const CHECK_EVERY = 60 * 60 * 1000;

/**
 * The service worker: the app works offline (against the AI) and opens fast from the home screen.
 *
 * An old build replaying an online game's log made by a newer one could desync, so a new version
 * goes live as soon as it can without interrupting anyone: straight away if it arrives just after the
 * app opened or the player asked for it, otherwise the next time the app goes to the background (the
 * reload happens unseen, and the game on screen comes back, see App.tsx). The app checks for a new
 * version each time it comes back to the foreground and hourly while it stays there, so it is never
 * more than one resume behind.
 */
export function startServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const opened = Date.now();
  let asked = false;
  let registration: ServiceWorkerRegistration | undefined;

  const update = registerSW({
    onRegisteredSW(_url, r) {
      registration = r;
      if (status === 'off') setStatus('idle');
    },
    onNeedRefresh() {
      setStatus('ready');
      if (asked || document.hidden || Date.now() - opened < 10_000) applyNow();
    },
  });

  applyNow = () => {
    setStatus('updating');
    void update(true); // the new worker takes over, and the page reloads when it does
  };

  checkNow = (ask) => {
    if (status === 'updating' || status === 'checking') return;
    asked ||= ask;
    if (!registration) return;
    if (!navigator.onLine) {
      if (ask) setStatus('offline');
      return;
    }
    if (ask) setStatus('checking');
    registration.update().then(
      () => {
        if (status !== 'checking') return; // ready (or updating) by now
        // Found one: it is downloading, and onNeedRefresh follows once it has.
        setStatus(registration!.installing || registration!.waiting ? 'updating' : 'current');
      },
      () => ask && setStatus('failed'), // the server unreachable: try again next time
    );
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (status === 'ready') applyNow();
    } else {
      checkNow(false);
    }
  });
  setInterval(() => document.hidden || checkNow(false), CHECK_EVERY);
}
