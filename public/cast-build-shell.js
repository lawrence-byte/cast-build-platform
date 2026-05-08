// CAST Build — shell behaviors.
// Loaded once on every project module page. Handles:
//   - Mobile sidebar drawer toggle
//   - Modal open/close (declarative via [data-cb-modal-open] / [data-cb-modal-close])
//   - Toast stack
//   - Keyboard shortcuts (Esc closes modal; / focuses search)
//   - Active sidebar nav highlighting based on current path
(function () {
  'use strict';

  // --- mobile sidebar drawer ---------------------------------------------
  function setupSidebarDrawer() {
    const sidebar = document.querySelector('.project-sidebar');
    if (!sidebar) return;

    let toggle = document.querySelector('.cb-sidebar-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.className = 'cb-sidebar-toggle';
      toggle.setAttribute('aria-label', 'Open navigation');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<span></span>';
      document.body.appendChild(toggle);
    }
    let backdrop = document.querySelector('.cb-sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'cb-sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    function open() {
      sidebar.classList.add('is-open');
      backdrop.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }
    function close() {
      sidebar.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.addEventListener('click', () => {
      sidebar.classList.contains('is-open') ? close() : open();
    });
    backdrop.addEventListener('click', close);
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('a')) close();
    });
  }

  // --- active sidebar nav --------------------------------------------------
  function highlightActiveNav() {
    const sidebar = document.querySelector('.project-sidebar-nav');
    if (!sidebar) return;
    const path = window.location.pathname;
    let bestMatch = null;
    let bestLength = -1;
    sidebar.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      // Treat exact match first; fall back to longest-prefix match.
      const url = new URL(href, window.location.origin);
      if (url.pathname === path) {
        bestMatch = a; bestLength = Infinity;
      } else if (url.pathname !== '/' && path.startsWith(url.pathname) && url.pathname.length > bestLength) {
        bestMatch = a; bestLength = url.pathname.length;
      }
    });
    if (bestMatch) bestMatch.classList.add('active');
  }

  // --- modals -------------------------------------------------------------
  let openModal = null;
  let lastFocus = null;

  function modalOpen(target) {
    const overlay = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!overlay) return;
    lastFocus = document.activeElement;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    openModal = overlay;
    document.body.style.overflow = 'hidden';
    // Focus first focusable inside
    const focusable = overlay.querySelector('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
    if (focusable) setTimeout(() => focusable.focus(), 30);
  }
  function modalClose() {
    if (!openModal) return;
    openModal.classList.remove('is-open');
    openModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    openModal = null;
  }
  function setupModals() {
    document.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-cb-modal-open]');
      if (opener) {
        e.preventDefault();
        modalOpen(opener.getAttribute('data-cb-modal-open'));
        return;
      }
      if (e.target.closest('[data-cb-modal-close]')) {
        e.preventDefault();
        modalClose();
        return;
      }
      if (openModal && e.target === openModal) modalClose();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openModal) modalClose();
    });
  }

  // --- toasts -------------------------------------------------------------
  function ensureToastStack() {
    let stack = document.querySelector('.cb-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'cb-toast-stack';
      stack.setAttribute('aria-live', 'polite');
      stack.setAttribute('aria-atomic', 'true');
      document.body.appendChild(stack);
    }
    return stack;
  }
  function toast(message, opts) {
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = 'cb-toast' + (opts && opts.kind ? ' cb-toast--' + opts.kind : '');
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s ease, transform .25s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 260);
    }, (opts && opts.timeout) || 4000);
  }

  // --- search shortcut ----------------------------------------------------
  function setupSearchShortcut() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !openModal) {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const search = document.querySelector('.cb-search, [data-cb-search]');
        if (search) {
          e.preventDefault();
          search.focus();
        }
      }
    });
  }

  function init() {
    setupSidebarDrawer();
    highlightActiveNav();
    setupModals();
    setupSearchShortcut();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CASTShell = { modalOpen, modalClose, toast };
})();
