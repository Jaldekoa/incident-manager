import { defineManifest } from '@crxjs/vite-plugin';
import { APP_DESCRIPTION, APP_NAME, OLLAMA_URL } from './src/config';

// Generados con `npm run icons` a partir de APP_ICON (src/config/app.ts).
const icons = Object.fromEntries([16, 32, 48, 128].map((size) => [size, `icons/icon-${size}.png`]));

export default defineManifest({
  manifest_version: 3,
  minimum_chrome_version: '116',
  name: APP_NAME,
  version: '0.1.0',
  description: APP_DESCRIPTION,
  icons,
  permissions: ['tabCapture', 'activeTab', 'storage', 'offscreen', 'contextMenus', 'clipboardWrite'],
  host_permissions: [`${OLLAMA_URL}/*`],
  action: { default_title: APP_NAME, default_popup: 'src/popup/index.html', default_icon: icons },
  background: { service_worker: 'src/background/index.ts', type: 'module' }
});
