import { BUILD, checkForUpdate, useUpdateStatus, type UpdateStatus } from '../../pwa';

const UPDATE_LABEL: Record<UpdateStatus, string | null> = {
  off: null,
  idle: 'Check for updates',
  checking: 'Checking…',
  current: 'Up to date',
  updating: 'Updating…',
  ready: 'Update now',
  offline: 'Offline',
  failed: 'Couldn’t check',
};

/** Which build this is, so a phone can tell whether the latest deploy has arrived, and a way to fetch it. */
export function VersionLine() {
  const status = useUpdateStatus();
  const label = UPDATE_LABEL[status];
  const when = BUILD.time.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <p className="version">
      Version {BUILD.id} · {when}
      {label && (
        <button disabled={status === 'checking' || status === 'updating'} onClick={checkForUpdate}>
          {label}
        </button>
      )}
    </p>
  );
}
