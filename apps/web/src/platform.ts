/**
 * An iPhone or iPad. iPadOS Safari calls itself a Mac, so a "Mac" with a touch screen counts too.
 * Every browser there is Safari underneath, with its own quirks (full screen, 3D layers).
 */
export const APPLE_TOUCH =
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
