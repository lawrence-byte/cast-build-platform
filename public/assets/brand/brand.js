// CAST Build brand asset resolver.
// Loads manifest.json once, then rewrites every <img data-brand-role="…"> on the page
// to point at the canonical file. Lets us swap an asset by editing manifest.json
// without touching any HTML.
//
// Usage:
//   <img data-brand-role="wordmark-light" alt="CAST BUILD">
//
// Optional fallback (rendered until manifest loads):
//   <img data-brand-role="wordmark-light" src="/assets/brand/cast-build-logo-transparent.png" alt="CAST BUILD">
//
// API:
//   await window.CASTBrand.ready;
//   window.CASTBrand.resolve('wordmark-light')   // → '/assets/brand/cast-build-logo-transparent.png'

(function () {
  'use strict';

  const MANIFEST_URL = '/assets/brand/manifest.json';
  const ASSET_DIR = '/assets/brand/';

  let manifest = null;
  const subscribers = [];

  function notify() {
    while (subscribers.length) {
      const fn = subscribers.shift();
      try { fn(manifest); } catch (e) { console.error('[brand] subscriber error', e); }
    }
  }

  function resolve(role) {
    if (!manifest) return null;
    const entry = manifest.roles && manifest.roles[role];
    if (!entry) {
      console.warn('[brand] unknown role:', role);
      return null;
    }
    return ASSET_DIR + entry.file;
  }

  function applyTo(scope) {
    if (!manifest) return;
    const root = scope || document;
    const imgs = root.querySelectorAll('img[data-brand-role]');
    imgs.forEach((img) => {
      const role = img.getAttribute('data-brand-role');
      const url = resolve(role);
      if (url && img.getAttribute('src') !== url) {
        img.setAttribute('src', url);
      }
    });
  }

  const ready = fetch(MANIFEST_URL, { credentials: 'same-origin' })
    .then((r) => {
      if (!r.ok) throw new Error('Failed to load brand manifest: HTTP ' + r.status);
      return r.json();
    })
    .then((m) => {
      manifest = m;
      applyTo();
      // Watch for new <img data-brand-role="…"> nodes injected later (modals, etc.)
      const obs = new MutationObserver((muts) => {
        for (const mut of muts) {
          mut.addedNodes.forEach((n) => {
            if (n.nodeType === 1) {
              if (n.matches && n.matches('img[data-brand-role]')) applyTo(n.parentElement || document);
              else if (n.querySelectorAll) applyTo(n);
            }
          });
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      notify();
      return m;
    })
    .catch((err) => {
      console.error('[brand] manifest load failed; falling back to static src=', err);
      notify();
      throw err;
    });

  window.CASTBrand = {
    ready,
    resolve,
    applyTo,
    onReady(cb) { if (manifest) cb(manifest); else subscribers.push(cb); },
  };
})();
