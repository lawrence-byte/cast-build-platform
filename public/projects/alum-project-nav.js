// Alüm project navigation shell — keeps project modules from feeling like dead-end pages.
(function () {
  'use strict';

  const rawPath = window.location.pathname;
  const path = rawPath.endsWith('.html') ? rawPath : rawPath + '.html';
  if (!/^\/projects\/(alum-|golden-hill)/.test(path)) return;
  if (document.querySelector('.alum-project-nav')) return;

  const primary = [
    ['Home', '/projects/golden-hill-procore.html'],
    ['Command', '/projects/alum-command-center.html'],
    ['Open Items', '/projects/alum-open-items.html'],
    ['RFIs', '/projects/alum-rfis.html'],
    ['Submittals', '/projects/alum-submittals.html'],
    ['Schedule', '/projects/alum-schedule.html'],
    ['Budget', '/projects/alum-budget.html'],
    ['Docs', '/projects/golden-hill-documents.html'],
  ];

  const more = [
    ['Management Center', '/projects/alum-management-control-center.html'],
    ['Meeting Minutes', '/projects/alum-meeting-minutes.html'],
    ['Change Events', '/projects/alum-change-events.html'],
    ['Daily Log', '/projects/alum-daily-log.html'],
    ['Commitments', '/projects/alum-commitments.html'],
    ['Accounting Tie-Out', '/projects/alum-accounting-tieout.html'],
    ['Dynamic Forecast', '/projects/alum-dynamic-forecast.html'],
    ['Closeout', '/projects/alum-closeout.html'],
    ['Directory', '/projects/alum-directory.html'],
    ['Reports', '/projects/alum-reports.html'],
  ];

  const css = document.createElement('style');
  css.textContent = `
    .alum-project-nav{position:sticky;top:0;z-index:1200;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 22px;background:rgba(24,24,22,.96);backdrop-filter:blur(16px);border-bottom:1px solid rgba(207,199,177,.18);box-shadow:0 10px 30px rgba(0,0,0,.18)}
    .alum-project-nav__brand{display:flex;align-items:center;gap:12px;min-width:max-content;color:#f7f3e8;text-decoration:none;font:700 10px/1.1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.18em;text-transform:uppercase}
    .alum-project-nav__brand img{width:62px;height:auto;display:block;object-fit:contain}
    .alum-project-nav__links{display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;overflow:auto;scrollbar-width:none}
    .alum-project-nav__links::-webkit-scrollbar{display:none}
    .alum-project-nav a,.alum-project-nav button{white-space:nowrap;border:1px solid transparent;background:transparent;color:rgba(247,243,232,.72);text-decoration:none;padding:8px 10px;font:700 10px/1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.13em;text-transform:uppercase;cursor:pointer}
    .alum-project-nav a:hover,.alum-project-nav button:hover{color:#fff;border-color:rgba(207,199,177,.28);background:rgba(255,255,255,.05)}
    .alum-project-nav a.is-active{color:#fff;border-color:rgba(207,199,177,.42);background:rgba(207,199,177,.12)}
    .alum-project-nav__more{position:relative;flex:0 0 auto}
    .alum-project-nav__menu{position:absolute;right:0;top:calc(100% + 8px);display:none;min-width:240px;padding:8px;background:#181816;border:1px solid rgba(207,199,177,.2);box-shadow:0 18px 48px rgba(0,0,0,.32)}
    .alum-project-nav__more.is-open .alum-project-nav__menu{display:grid;gap:4px}
    .alum-project-nav__menu a{display:block;padding:11px 12px}
    .alum-project-nav-spacer .app .top,.alum-project-nav-spacer .app .tabs,.alum-project-nav-spacer .project-sidebar{display:none!important}
    .alum-project-nav-spacer .project-dashboard-wrapper{display:block!important}
    .alum-project-nav-spacer .project-main-content{margin-left:0!important;width:100%!important}
    @media(max-width:860px){.alum-project-nav{align-items:flex-start;flex-direction:column;padding:10px 14px}.alum-project-nav__links{justify-content:flex-start;width:100%}.alum-project-nav__brand img{width:52px}}
  `;
  document.head.appendChild(css);

  const nav = document.createElement('nav');
  nav.className = 'alum-project-nav';
  nav.setAttribute('aria-label', 'Alüm project navigation');

  const brand = document.createElement('a');
  brand.className = 'alum-project-nav__brand';
  brand.href = '/projects/golden-hill-procore.html';
  brand.innerHTML = '<img src="/assets/brand/alum-logo-white.svg" alt="ALÜM"><span>Project Controls</span>';

  const links = document.createElement('div');
  links.className = 'alum-project-nav__links';
  for (const [label, href] of primary) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (path === href) a.className = 'is-active';
    links.appendChild(a);
  }

  const moreWrap = document.createElement('div');
  moreWrap.className = 'alum-project-nav__more';
  const moreButton = document.createElement('button');
  moreButton.type = 'button';
  moreButton.textContent = 'More';
  moreButton.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('div');
  menu.className = 'alum-project-nav__menu';
  for (const [label, href] of more) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (path === href) a.className = 'is-active';
    menu.appendChild(a);
  }
  moreButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = moreWrap.classList.toggle('is-open');
    moreButton.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', () => {
    moreWrap.classList.remove('is-open');
    moreButton.setAttribute('aria-expanded', 'false');
  });
  moreWrap.append(moreButton, menu);
  links.appendChild(moreWrap);

  nav.append(brand, links);
  document.body.classList.add('alum-project-nav-spacer');
  document.body.insertBefore(nav, document.body.firstChild);
})();
