import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works under a subpath (e.g. GitHub Pages /quantum/).
  base: './',
  server: { port: 5173 },
});
