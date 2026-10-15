/** Where a game is played: on this device (a tablet) or online (a globe). */
export function WhereIcon({ online }: { online: boolean }) {
  return (
    <svg
      className="where-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {online ? (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M1.5 8h13M8 1.5c-2.2 2.4-2.2 10.6 0 13M8 1.5c2.2 2.4 2.2 10.6 0 13" />
        </>
      ) : (
        <>
          <rect x="3" y="1.5" width="10" height="13" rx="2" />
          <path d="M7 12h2" />
        </>
      )}
    </svg>
  );
}
