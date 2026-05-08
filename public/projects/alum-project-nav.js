// Alüm project navigation shell — keeps project modules from feeling like one-way dead-end pages.
(function () {
  'use strict';

  const rawPath = window.location.pathname;
  const path = rawPath.endsWith('.html') ? rawPath : rawPath + '.html';
  if (!/^\/projects\/(alum-|golden-hill)/.test(path)) return;
  if (document.querySelector('.alum-project-nav')) return;

  const groups = [
    {
      label: 'Project',
      items: [
        ['Home', '/projects/golden-hill-procore.html'],
        ['Command Center', '/projects/alum-command-center.html'],
        ['Management Center', '/projects/alum-management-control-center.html'],
        ['Open Items', '/projects/alum-open-items.html'],
      ],
    },
    {
      label: 'Controls',
      items: [
        ['RFIs', '/projects/alum-rfis.html'],
        ['Submittals', '/projects/alum-submittals.html'],
        ['Change Events', '/projects/alum-change-events.html'],
        ['Meeting Minutes', '/projects/alum-meeting-minutes.html'],
      ],
    },
    {
      label: 'Field',
      items: [
        ['Schedule', '/projects/alum-schedule.html'],
        ['Daily Log', '/projects/alum-daily-log.html'],
        ['Punch List', '/projects/alum-punch-list.html'],
        ['Quality', '/projects/alum-quality.html'],
      ],
    },
    {
      label: 'Financials',
      items: [
        ['Budget', '/projects/alum-budget.html'],
        ['Budget Review', '/projects/alum-budget-exceptions.html'],
        ['Commitments', '/projects/alum-commitments.html'],
        ['Forecast', '/projects/alum-dynamic-forecast.html'],
        ['Accounting Tie-Out', '/projects/alum-accounting-tieout.html'],
      ],
    },
    {
      label: 'Documents + Closeout',
      items: [
        ['Documents', '/projects/golden-hill-documents.html'],
        ['Doc Intelligence', '/projects/alum-document-intelligence.html'],
        ['Specifications', '/projects/alum-specifications.html'],
        ['Data Room', '/projects/alum-data-room.html'],
        ['Closeout', '/projects/alum-closeout.html'],
      ],
    },
    {
      label: 'Team',
      items: [
        ['Directory', '/projects/alum-directory.html'],
        ['Reports', '/projects/alum-reports.html'],
      ],
    },
  ];

  const primary = [
    ['Home', '/projects/golden-hill-procore.html'],
    ['Command', '/projects/alum-command-center.html'],
    ['RFIs', '/projects/alum-rfis.html'],
    ['Schedule', '/projects/alum-schedule.html'],
    ['Budget', '/projects/alum-budget.html'],
    ['Docs', '/projects/golden-hill-documents.html'],
  ];

  const css = document.createElement('style');
  css.textContent = `
    .alum-project-nav{position:sticky;top:0;z-index:1300;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 22px 10px 296px;background:rgba(24,24,22,.96);backdrop-filter:blur(16px);border-bottom:1px solid rgba(207,199,177,.18);box-shadow:0 10px 30px rgba(0,0,0,.18)}
    .alum-project-nav__brand{display:none;color:#f7f3e8;text-decoration:none;font:700 10px/1.1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.18em;text-transform:uppercase}
    .alum-project-nav__brand img{width:54px;height:auto;display:block;object-fit:contain}
    .alum-project-nav__links{display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;overflow:auto;scrollbar-width:none;width:100%}
    .alum-project-nav__links::-webkit-scrollbar{display:none}
    .alum-project-nav a{white-space:nowrap;border:1px solid transparent;background:transparent;color:rgba(247,243,232,.72);text-decoration:none;padding:8px 10px;font:700 10px/1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.13em;text-transform:uppercase}
    .alum-project-nav a:hover{color:#fff;border-color:rgba(207,199,177,.28);background:rgba(255,255,255,.05)}
    .alum-project-nav a.is-active{color:#fff;border-color:rgba(207,199,177,.42);background:rgba(207,199,177,.12)}

    .alum-section-rail{position:fixed;inset:0 auto 0 0;z-index:1250;width:272px;background:#181816;color:#f7f3e8;border-right:1px solid rgba(207,199,177,.18);overflow:auto;padding:24px 18px 28px;box-shadow:16px 0 38px rgba(0,0,0,.12);scrollbar-width:thin;scrollbar-color:rgba(207,199,177,.28) transparent}
    .alum-section-rail__brand{display:flex;align-items:center;gap:12px;padding:0 6px 20px;margin-bottom:16px;border-bottom:1px solid rgba(207,199,177,.16);color:#f7f3e8;text-decoration:none;font:700 10px/1.1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.18em;text-transform:uppercase}
    .alum-section-rail__brand img{width:82px;height:auto;object-fit:contain;display:block}
    .alum-section-rail__group{margin:18px 0 8px;padding:0 8px;color:rgba(207,199,177,.62);font:800 10px/1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.18em;text-transform:uppercase}
    .alum-section-rail__link{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:0;border-left:2px solid transparent;color:rgba(247,243,232,.74);text-decoration:none;font:700 11px/1.15 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;text-transform:uppercase}
    .alum-section-rail__link:hover{background:rgba(255,255,255,.055);color:#fff;border-left-color:rgba(207,199,177,.42)}
    .alum-section-rail__link.is-active{background:rgba(207,199,177,.12);border-left-color:#cfc7b1;color:#fff}
    .alum-section-rail__link.is-active::after{content:'•';color:#cfc7b1;font-size:18px;line-height:0}
    .alum-section-rail__note{margin:22px 8px 0;padding-top:16px;border-top:1px solid rgba(207,199,177,.16);color:rgba(247,243,232,.52);font:600 11px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}

    .alum-project-nav-spacer .app .top,.alum-project-nav-spacer .app .tabs,.alum-project-nav-spacer .project-sidebar,.alum-project-nav-spacer>header.top,.alum-project-nav-spacer>.wrap>.side{display:none!important}
    .alum-project-nav-spacer .app{padding-left:272px!important}
    .alum-project-nav-spacer .project-dashboard-wrapper{display:block!important}
    .alum-project-nav-spacer .project-main-content{margin-left:272px!important;width:auto!important}
    .alum-project-nav-spacer .dashboard{padding-left:calc(24px + 272px)!important}
    .alum-project-nav-spacer>.wrap{margin-left:272px!important;width:calc(100% - 272px)!important;display:block!important;grid-template-columns:1fr!important;min-width:0!important}
    .alum-project-nav-spacer>.wrap>.main{max-width:none!important;width:100%!important;box-sizing:border-box!important}

    @media(max-width:1050px){
      .alum-section-rail{position:relative;width:auto;inset:auto;height:auto;padding:18px 14px;box-shadow:none;border-right:none;border-bottom:1px solid rgba(207,199,177,.18)}
      .alum-section-rail__brand{padding-bottom:14px;margin-bottom:12px}
      .alum-section-rail__group{margin-top:14px}
      .alum-project-nav{padding:10px 14px;position:sticky}.alum-project-nav__brand{display:flex;align-items:center;gap:10px}.alum-project-nav__links{justify-content:flex-start}
      .alum-project-nav-spacer .app,.alum-project-nav-spacer .dashboard{padding-left:0!important}
      .alum-project-nav-spacer .project-main-content{margin-left:0!important;width:100%!important}
      .alum-project-nav-spacer>.wrap{margin-left:0!important;width:100%!important}
    }
  `;
  document.head.appendChild(css);

  function link(label, href, className) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    a.className = className || '';
    if (path === href) a.classList.add('is-active');
    return a;
  }

  const topNav = document.createElement('nav');
  topNav.className = 'alum-project-nav';
  topNav.setAttribute('aria-label', 'Alüm quick navigation');
  const brand = document.createElement('a');
  brand.className = 'alum-project-nav__brand';
  brand.href = '/projects/golden-hill-procore.html';
  brand.innerHTML = '<img src="/assets/brand/alum-logo-white.svg" alt="ALÜM"><span>Project Controls</span>';
  const topLinks = document.createElement('div');
  topLinks.className = 'alum-project-nav__links';
  for (const [label, href] of primary) topLinks.appendChild(link(label, href));
  topNav.append(brand, topLinks);

  const rail = document.createElement('aside');
  rail.className = 'alum-section-rail';
  rail.setAttribute('aria-label', 'Alüm page sections');
  const railBrand = document.createElement('a');
  railBrand.className = 'alum-section-rail__brand';
  railBrand.href = '/projects/golden-hill-procore.html';
  railBrand.innerHTML = '<img src="/assets/brand/alum-logo-white.svg" alt="ALÜM"><span>Project Controls</span>';
  rail.appendChild(railBrand);
  for (const group of groups) {
    const heading = document.createElement('div');
    heading.className = 'alum-section-rail__group';
    heading.textContent = group.label;
    rail.appendChild(heading);
    for (const [label, href] of group.items) rail.appendChild(link(label, href, 'alum-section-rail__link'));
  }
  const note = document.createElement('p');
  note.className = 'alum-section-rail__note';
  note.textContent = 'Read-first project controls. Use CAST BUILD A.O for source-system writes.';
  rail.appendChild(note);

  document.body.classList.add('alum-project-nav-spacer');
  document.body.insertBefore(topNav, document.body.firstChild);
  document.body.insertBefore(rail, topNav.nextSibling);
})();
