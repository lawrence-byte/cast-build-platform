// CAST Build access gate — temporary shared-password account scaffold.
// This is not a backend security boundary. Replace with server auth before source-system writes or sensitive production access.
(function () {
  'use strict';

  const SESSION_KEY = 'castBuildAuthSession.v1';
  const PASSWORD_SHA256 = 'ccbb21152c898da8dfc205c11d6e42e5aebda5de3133dbafd5597848ffb55996';
  const USERS = [
    { email: 'joe@cast-dev.com', name: 'Joe Garza', role: 'CAST Team' },
    { email: 'dan@cast-dev.com', name: 'Dan Meeh', role: 'CAST Team' },
    { email: 'lawrence@cast-dev.com', name: 'Lawrence Howard', role: 'Admin' },
    { email: 'jackie@cast-dev.com', name: 'Jackeline Villanueva', role: 'CAST Team' },
    { email: 'carlos@cast-dev.com', name: 'Carlos Gutierrez', role: 'CAST Team' },
    { email: 'denise@cast-dev.com', name: 'Denise Swift', role: 'CAST Team' },
    { email: 'karla@cast-dev.com', name: 'Karla Mohnhaupt', role: 'CAST Team' },
  ];

  const PUBLIC_PATHS = new Set(['/assets/brand/brand.js']);
  if (PUBLIC_PATHS.has(window.location.pathname)) return;

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
  function allowedUser(email) { return USERS.find((user) => user.email === normalizeEmail(email)); }
  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  function readSession() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!session || !allowedUser(session.email)) return null;
      return session;
    } catch { return null; }
  }
  function saveSession(user) {
    const session = { email: user.email, name: user.name, role: user.role, signedInAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }
  function setLocked(locked) { document.documentElement.classList.toggle('cast-auth-locked', locked); }
  function isLandingPage() { return window.location.pathname === '/' || window.location.pathname.endsWith('/index.html'); }
  function ensureStyle() {
    if (document.getElementById('castAuthStyles')) return;
    const style = document.createElement('style');
    style.id = 'castAuthStyles';
    style.textContent = `
      html.cast-auth-locked body > :not(.cast-auth-overlay){visibility:hidden!important;pointer-events:none!important}
      .cast-auth-overlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:radial-gradient(circle at top left,rgba(207,199,177,.32),transparent 34%),#181816;color:#f7f3e8;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:22px}
      .cast-auth-card{width:min(440px,100%);border:1px solid rgba(207,199,177,.32);background:rgba(24,24,22,.92);box-shadow:0 30px 90px rgba(0,0,0,.42);padding:28px}.cast-auth-card img{width:210px;max-width:70%;display:block;margin:0 0 24px}.cast-auth-card h1{margin:0 0 8px;font-family:Georgia,serif;font-size:30px;font-weight:400;letter-spacing:.04em}.cast-auth-card p{margin:0 0 18px;color:rgba(247,243,232,.68);line-height:1.5}.cast-auth-card label{display:block;margin:12px 0 6px;font-size:11px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:rgba(207,199,177,.9)}.cast-auth-card input{width:100%;box-sizing:border-box;border:1px solid rgba(207,199,177,.38);background:#f7f3e8;color:#181816;padding:12px;font:inherit}.cast-auth-card button{width:100%;margin-top:18px;border:0;background:#cfc7b1;color:#181816;padding:12px 14px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}.cast-auth-card button:hover{background:#efe7d6}.cast-auth-error{min-height:18px;margin-top:10px;color:#ffcf9a;font-size:13px}.cast-auth-note{margin-top:16px!important;font-size:12px;color:rgba(247,243,232,.5)!important}.cast-auth-userbar{position:fixed;right:112px;top:18px;z-index:2100;background:#181816;color:#f7f3e8;border:1px solid rgba(207,199,177,.32);box-shadow:0 14px 34px rgba(0,0,0,.18);display:flex;align-items:center;gap:10px;padding:8px 10px;font:700 10px/1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.09em;text-transform:uppercase}.cast-auth-userbar button{border:1px solid rgba(207,199,177,.28);background:transparent;color:#f7f3e8;padding:5px 7px;font:inherit;cursor:pointer}.cast-auth-userbar button:hover{background:rgba(255,255,255,.08)}
      body.cast-auth-landing .cast-auth-userbar{display:none!important}
      @media(max-width:700px){.cast-auth-userbar{top:16px;right:88px;bottom:auto}.cast-auth-card{padding:22px}}
    `;
    document.head.appendChild(style);
  }
  function showUserbar(session) {
    document.querySelector('.cast-auth-userbar')?.remove();
    const bar = document.createElement('div');
    bar.className = 'cast-auth-userbar';
    bar.innerHTML = `<span>${esc(session.name || session.email)}</span><button type="button">Sign out</button>`;
    bar.querySelector('button').addEventListener('click', () => { clearSession(); window.location.reload(); });
    document.body.appendChild(bar);
  }
  function unlock(session) {
    setLocked(false);
    document.querySelector('.cast-auth-overlay')?.remove();
    showUserbar(session);
    window.CASTAuth = { session, users: USERS.map((user) => ({ ...user })) };
    window.dispatchEvent(new CustomEvent('cast-auth:ready', { detail: session }));
  }
  function showLogin() {
    ensureStyle();
    setLocked(true);
    document.querySelector('.cast-auth-overlay')?.remove();
    const overlay = document.createElement('section');
    overlay.className = 'cast-auth-overlay';
    overlay.innerHTML = `<form class="cast-auth-card" autocomplete="on"><img src="/assets/brand/cast-build-stacked-white-on-charcoal.png" alt="CAST Build"><h1>Team sign in</h1><p>Use your CAST email to enter the platform. Temporary shared-password access is enabled until backend auth is connected.</p><label for="castAuthEmail">Email</label><input id="castAuthEmail" name="email" type="email" autocomplete="username" required placeholder="name@cast-dev.com"><label for="castAuthPassword">Password</label><input id="castAuthPassword" name="password" type="password" autocomplete="current-password" required><button type="submit">Sign in</button><div class="cast-auth-error" role="alert"></div><p class="cast-auth-note">Allowed accounts: ${USERS.map((user) => esc(user.email)).join(', ')}</p></form>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector('form');
    const error = overlay.querySelector('.cast-auth-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = '';
      const email = normalizeEmail(form.email.value);
      const user = allowedUser(email);
      if (!user) { error.textContent = 'That email is not on the CAST Build account list.'; return; }
      const hash = await sha256(form.password.value);
      if (hash !== PASSWORD_SHA256) { error.textContent = 'Password does not match the temporary team password.'; return; }
      unlock(saveSession(user));
    });
    setTimeout(() => overlay.querySelector('input')?.focus(), 30);
  }
  function init() {
    ensureStyle();
    document.body.classList.toggle('cast-auth-landing', isLandingPage());
    const session = readSession();
    if (session) unlock(session);
    else showLogin();
  }
  setLocked(true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
