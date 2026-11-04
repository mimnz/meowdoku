/* Instalação PWA: não interfere na partida, na seed ou no localStorage. */
(() => {
  'use strict';
  const installButton = document.getElementById('installAppBtn');
  const dialog = document.getElementById('installHelpDialog');
  const closeButton = document.getElementById('installHelpClose');
  let deferredInstall = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function updateButton() {
    installButton.hidden = standalone();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstall = event;
    updateButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    installButton.hidden = true;
  });

  installButton.addEventListener('click', async () => {
    if (standalone()) return;
    if (deferredInstall) {
      const event = deferredInstall;
      deferredInstall = null;
      try { await event.prompt(); await event.userChoice; }
      catch (error) { console.warn('Instalação nativa indisponível:', error); }
    } else if (!dialog.open) {
      dialog.showModal();
    }
  });

  closeButton.addEventListener('click', () => dialog.close());
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', updateButton);
  updateButton();

  // O protocolo file:// não permite service workers. O GitHub Pages já usa HTTPS.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .catch(error => console.warn('Modo offline indisponível:', error));
    });
  }
})();
