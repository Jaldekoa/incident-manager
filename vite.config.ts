import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: 'chrome116', // igual que minimum_chrome_version del manifest
    rollupOptions: {
      // Páginas que no aparecen en el manifest: hay que declararlas para que se empaqueten.
      input: {
        offscreen: 'src/offscreen/index.html',
        permission: 'src/permission/index.html'
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    cors: { origin: [/^chrome-extension:\/\//] }
  }
});
