import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import { APP_NAME } from './src/config';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    // Sustituye %APP_NAME% en los <title> de las páginas HTML por el nombre definido en src/config.
    { name: 'app-name', transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME) }
  ],
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
