import { $ } from './ui.js';

// Página auxiliar: el popup no puede mostrar la petición de permiso de micrófono, una pestaña sí.
const message = $('#message');
const siteSettingsButton = $('#open-site-settings');

siteSettingsButton.addEventListener('click', () => {
  chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(location.origin)}` });
});

try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
  message.textContent = 'Permiso concedido. Esta pestaña se cerrará; vuelve a abrir la extensión.';
  setTimeout(async () => chrome.tabs.remove((await chrome.tabs.getCurrent()).id), 1500);
} catch (error) {
  message.textContent = `No se concedió el permiso (${error.message}). Habilita el micrófono en los permisos de la extensión y vuelve a intentarlo.`;
  siteSettingsButton.hidden = false;
}
