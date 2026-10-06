import { networkInterfaces } from 'node:os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** This machine's address on the local network, so online invites made in dev work on other devices. */
function lanAddress(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return '';
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Relative asset paths so the build works under a subpath (e.g. GitHub Pages /quantum/).
  base: './',
  // All addresses: IPv4 and IPv6 localhost (browsers differ in which "localhost" means), and the
  // local network, for trying online play from a phone.
  server: { port: 5173, host: true },
  // Dev only: a build must not carry this machine's address.
  define: { __LAN_ADDRESS__: JSON.stringify(command === 'serve' ? lanAddress() : '') },
}));
