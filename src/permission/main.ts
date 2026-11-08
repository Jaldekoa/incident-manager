import 'material-symbols/outlined.css';
import '../popup/dashboard.css';
import './permission.css';
import { APP_ICON, APP_NAME } from '../config';
import { errorMessage } from '../shared/errors';

document.querySelector('#brand-icon')!.textContent = APP_ICON;
document.querySelector('#brand-name')!.textContent = APP_NAME;

// Página auxiliar: el popup no puede mostrar la petición de permiso de micrófono, una pestaña sí.
const message = document.querySelector<HTMLParagraphElement>('#message')!;
const siteSettingsButton = document.querySelector<HTMLButtonElement>('#open-site-settings')!;

siteSettingsButton.addEventListener('click', () => {
  chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(location.origin)}` });
});

async function closeThisTab() {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id !== undefined) await chrome.tabs.remove(tab.id);
}

try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
  message.textContent = 'Permiso concedido. Esta pestaña se cerrará; vuelve a abrir la extensión.';
  setTimeout(closeThisTab, 1500);
} catch (error) {
  message.textContent = `No se concedió el permiso (${errorMessage(error)}). Habilita el micrófono en los permisos de la extensión y vuelve a intentarlo.`;
  siteSettingsButton.hidden = false;
}
