// Alüm project navigation shell — one source of truth for project movement and section structure.
(function () {
  'use strict';

  const LANDING_PAGE = '/';
  const HOME = '/projects/golden-hill-procore.html';
  const rawPath = window.location.pathname;
  const path = rawPath.endsWith('.html') ? rawPath : rawPath + '.html';
  if (!/^\/projects\/(alum-|golden-hill)/.test(path)) return;
  if (document.querySelector('.alum-project-nav')) return;

  const groups = [
    {
      label: 'Dashboard',
      summary: 'Important project signals',
      items: [
        ['Project Home', HOME, 'i-home'],
        ['CAST Server', '/projects/alum-folder-registers.html', 'i-data'],
        ['Command Center', '/projects/alum-command-center.html', 'i-dashboard'],
        ['Open Items', '/projects/alum-open-items.html', 'i-list'],
        ['Management Center', '/projects/alum-management-control-center.html', 'i-cog'],
      ],
    },
    {
      label: 'Documents',
      summary: 'RFIs, submittals, drawings, specs, data room',
      items: [
        ['RFIs', '/projects/alum-rfis.html', 'i-help'],
        ['Submittals', '/projects/alum-submittals.html', 'i-clipboard'],
        ['Meeting Minutes', '/projects/alum-meeting-minutes.html', 'i-clock'],
        ['Drawing Log', '/projects/cast-drawing-log.html', 'i-document'],
        ['Document Register', '/projects/cast-document-register.html', 'i-data'],
        ['Documents', '/projects/golden-hill-documents.html', 'i-document'],
        ['Doc Intelligence', '/projects/alum-document-intelligence.html', 'i-search'],
        ['Specifications', '/projects/alum-specifications.html', 'i-spec'],
        ['Data Room', '/projects/alum-data-room.html', 'i-data'],
        ['Closeout', '/projects/alum-closeout.html', 'i-flag'],
      ],
    },
    {
      label: 'CONTRACTS',
      summary: 'Prime contract and change control',
      items: [
        ['Prime Contract', '/projects/alum-contracts.html', 'i-document'],
        ['Potential Change Orders', '/projects/alum-potential-change-orders.html', 'i-alert'],
        ['Change Events', '/projects/alum-change-events.html', 'i-swap'],
        ['Approved Change Orders', '/projects/alum-budget-changes.html', 'i-check'],
        ['Owner Billings', '/projects/alum-owner-billings.html', 'i-money'],
      ],
    },
    {
      label: 'Financials',
      summary: 'Budget and cost controls',
      items: [
        ['Budget', '/projects/alum-budget.html', 'i-money'],
        ['Budget Review', '/projects/alum-budget-exceptions.html', 'i-alert'],
        ['Commitments', '/projects/alum-commitments.html', 'i-link'],
        ['Forecast', '/projects/alum-dynamic-forecast.html', 'i-trend-up'],
        ['Accounting Tie-Out', '/projects/alum-accounting-tieout.html', 'i-check'],
      ],
    },
    {
      label: 'Field',
      summary: 'Site execution',
      items: [
        ['Schedule', '/projects/alum-schedule.html', 'i-calendar'],
        ['Daily Log', '/projects/alum-daily-log.html', 'i-sun'],
        ['Inspections', '/projects/alum-inspections.html', 'i-search'],
        ['Punch List', '/projects/alum-punch-list.html', 'i-check'],
        ['Safety', '/projects/alum-safety.html', 'i-alert'],
        ['Quality', '/projects/alum-quality.html', 'i-star'],
      ],
    },
    {
      label: 'Reporting / Operations',
      summary: 'Reports, people, operating view',
      items: [
        ['Reports', '/projects/alum-reports.html', 'i-report'],
        ['Quality Control', '/projects/alum-quality-control-report.html', 'i-star'],
        ['Project Photos & Videos', '/projects/alum-photos-videos.html', 'i-grid'],
        ['Directory', '/projects/alum-directory.html', 'i-users'],
        ['Status Report', '/projects/alum-executive-report.html', 'i-dashboard'],
      ],
    },
  ];

  const primary = [
    ['Home', HOME],
    ['Dashboard', HOME],
    ['Critical Items', '/projects/alum-open-items.html'],
    ['Documents', '/projects/golden-hill-documents.html'],
    ['Financials', '/projects/alum-budget.html'],
    ['Field', '/projects/alum-schedule.html'],
    ['Reporting', '/projects/alum-reports.html'],
  ];

  const projectName = document.body.dataset.projectName || document.querySelector('meta[name="project-name"]')?.content || 'ALÜM';
  const projectLogo = document.body.dataset.projectLogo || '/assets/brand/cast-build-supplied-wordmark-transparent.png';

  function loadGlobalIntakeAssets() {
    if (!document.querySelector('link[data-cast-document-intake]')) {
      const linkEl = document.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.href = '/cast-document-intake.css';
      linkEl.dataset.castDocumentIntake = 'true';
      document.head.appendChild(linkEl);
    }
    return new Promise((resolve) => {
      if (window.CastDocumentIntake) return resolve(window.CastDocumentIntake);
      let script = document.querySelector('script[data-cast-document-intake]');
      if (!script) {
        script = document.createElement('script');
        script.src = '/cast-document-intake.js';
        script.defer = true;
        script.dataset.castDocumentIntake = 'true';
        document.body.appendChild(script);
      }
      script.addEventListener('load', () => resolve(window.CastDocumentIntake), { once: true });
      script.addEventListener('error', () => resolve(null), { once: true });
    });
  }

  function loadAuthGate() {
    return new Promise((resolve) => {
      if (window.CASTAuth) return resolve(window.CASTAuth);
      let script = document.querySelector('script[data-cast-auth]');
      if (!script) {
        script = document.createElement('script');
        script.src = '/cast-auth.js';
        script.defer = true;
        script.dataset.castAuth = 'true';
        document.body.appendChild(script);
      }
      script.addEventListener('load', () => resolve(window.CASTAuth), { once: true });
      script.addEventListener('error', () => resolve(null), { once: true });
    });
  }

  function loadTeamAssistant() {
    return new Promise((resolve) => {
      if (window.CastTeamAssistant) return resolve(window.CastTeamAssistant);
      let script = document.querySelector('script[data-cast-team-assistant]');
      if (!script) {
        script = document.createElement('script');
        script.src = '/cast-team-assistant.js';
        script.defer = true;
        script.dataset.castTeamAssistant = 'true';
        document.body.appendChild(script);
      }
      script.addEventListener('load', () => resolve(window.CastTeamAssistant), { once: true });
      script.addEventListener('error', () => resolve(null), { once: true });
    });
  }

  const css = document.createElement('style');
  css.textContent = `
    .alum-project-nav{position:sticky;top:0;z-index:1300;display:flex;align-items:center;justify-content:flex-start;gap:18px;min-height:70px;padding:10px 22px;background:rgba(24,24,22,.96);backdrop-filter:blur(16px);border-bottom:1px solid rgba(207,199,177,.18);box-shadow:0 10px 30px rgba(0,0,0,.18)}
    .alum-project-nav__brand{display:flex;align-items:center;justify-content:flex-start;flex:0 0 auto;min-width:238px;color:#f7f3e8;text-decoration:none;border-color:transparent!important;background:transparent!important;padding-inline:0!important;box-shadow:none!important}
    .alum-project-nav__brand img{width:238px;max-width:100%;height:auto;display:block;object-fit:contain;background:transparent!important;box-shadow:none!important}
    .alum-project-nav__wordmark{display:inline-flex;align-items:baseline;gap:12px;background:transparent!important;color:#fff;font:300 28px/1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.18em;text-transform:uppercase;white-space:nowrap;box-shadow:none!important}
    .alum-project-nav__wordmark strong{font-weight:650;letter-spacing:.16em}
    .alum-project-mark__name{display:none}
    .alum-project-nav__links{display:flex;align-items:center;justify-content:flex-start;gap:6px;min-width:0;overflow:auto;scrollbar-width:none;width:100%}
    .alum-project-nav__assistant-slot{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;display:grid;place-items:center;pointer-events:none}
    .alum-project-nav__assistant-slot .cast-team-assistant-host{pointer-events:auto}
    .alum-project-nav__links::-webkit-scrollbar{display:none}
    .alum-project-nav a{white-space:nowrap;border:1px solid transparent;background:transparent;color:rgba(247,243,232,.72);text-decoration:none;padding:8px 10px;font:700 10px/1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.13em;text-transform:uppercase}
    .alum-project-nav a:hover{color:#fff;border-color:rgba(207,199,177,.28);background:rgba(255,255,255,.05)}
    .alum-project-nav a.is-active{color:#fff;border-color:rgba(207,199,177,.42);background:rgba(207,199,177,.12)}

    .alum-section-rail{position:fixed;inset:70px auto 0 0;z-index:1250;width:272px;background:#181816;color:#f7f3e8;border-right:1px solid rgba(207,199,177,.18);overflow:auto;padding:24px 18px 28px;box-shadow:16px 0 38px rgba(0,0,0,.12);scrollbar-width:thin;scrollbar-color:rgba(207,199,177,.28) transparent}
    .alum-section-rail__brand{display:flex;flex-direction:column;align-items:center;justify-content:center;width:max-content;max-width:100%;padding:2px 8px 8px;margin:0 auto 14px;border-bottom:1px solid rgba(207,199,177,.16);color:#f7f3e8;text-decoration:none;text-align:center;overflow:visible}
    .alum-section-rail__brand img{display:none!important}
    .alum-section-rail__project-name{display:block;width:max-content;max-width:none;color:#f7f3e8;font:400 34px/1 "Cormorant Garamond",Georgia,"Times New Roman",serif;letter-spacing:.18em;text-transform:uppercase;text-align:center;text-indent:.18em;padding-top:0;overflow:visible;white-space:nowrap}
    .alum-section-rail__group{margin:18px 0 5px;padding:0 8px;color:rgba(207,199,177,.68);font:800 10px/1 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.15em;text-transform:uppercase}
    .alum-section-rail__summary{margin:0 8px 7px;color:rgba(247,243,232,.42);font:600 10px/1.35 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.07em;text-transform:uppercase}
    .alum-section-rail__tabs{display:grid;gap:2px;margin-bottom:6px}
    .alum-section-rail__link{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:0;border-left:2px solid transparent;color:rgba(247,243,232,.74);text-decoration:none;font:700 11px/1.15 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;text-transform:uppercase}
    .alum-section-rail__label{display:inline-flex;align-items:center;gap:9px;min-width:0}
    .alum-section-rail__icon{width:15px;height:15px;flex:0 0 15px;color:rgba(207,199,177,.84)}
    .alum-section-rail__text{overflow:hidden;text-overflow:ellipsis}
    .alum-section-rail__link:hover{background:rgba(255,255,255,.055);color:#fff;border-left-color:rgba(207,199,177,.42)}
    .alum-section-rail__link.is-active{background:rgba(207,199,177,.12);border-left-color:#cfc7b1;color:#fff}
    .alum-section-rail__link.is-active::after{content:'•';color:#cfc7b1;font-size:18px;line-height:0}
    .alum-section-rail__note{margin:22px 8px 0;padding-top:16px;border-top:1px solid rgba(207,199,177,.16);color:rgba(247,243,232,.52);font:600 11px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}

    .alum-project-nav-spacer .app .top,.alum-project-nav-spacer .app .tabs,.alum-project-nav-spacer .project-sidebar,.alum-project-nav-spacer>header.top,.alum-project-nav-spacer>.wrap>.side{display:none!important}
    .alum-project-nav-spacer .app{padding-left:272px!important}
    .alum-project-nav-spacer .project-dashboard-wrapper{display:block!important}
    .alum-project-nav-spacer .project-main-content{margin-left:272px!important;width:auto!important}
    .alum-project-nav-spacer .dashboard{margin-left:0!important;padding-left:24px!important}
    .alum-project-nav-spacer>.wrap{margin-left:272px!important;width:calc(100% - 272px)!important;display:block!important;grid-template-columns:1fr!important;min-width:0!important}
    .alum-project-nav-spacer>.wrap>.main{max-width:none!important;width:100%!important;box-sizing:border-box!important}

    @media(max-width:1050px){
      .alum-section-rail{display:none!important}
      .alum-project-nav{padding:10px 14px;position:sticky;min-height:64px}.alum-project-nav__links{justify-content:flex-start}.alum-project-nav__assistant-slot{left:auto;right:14px;transform:translateY(-50%)}
      .alum-project-nav__brand{min-width:170px}
      .alum-project-nav__brand img{width:170px}
      .alum-project-nav__wordmark{font-size:20px;gap:8px;letter-spacing:.14em}
      .alum-section-rail__brand img{display:none!important}
      .alum-section-rail__project-name{font-size:30px;line-height:1.2}
      .alum-project-nav-spacer .app,.alum-project-nav-spacer .dashboard{padding-left:0!important}
      .alum-project-nav-spacer .project-main-content{margin-left:0!important;width:100%!important}
      .alum-project-nav-spacer>.wrap{margin-left:0!important;width:100%!important}
    }
  `;
  document.head.appendChild(css);

  function iconMarkup(icon) {
    if (!icon) return '';
    return `<svg class="alum-section-rail__icon" aria-hidden="true"><use href="/assets/brand/icons.svg#${icon}"></use></svg>`;
  }

  function link(label, href, className, icon) {
    const a = document.createElement('a');
    a.href = href;
    a.className = className || '';
    if (icon) {
      a.innerHTML = `<span class="alum-section-rail__label">${iconMarkup(icon)}<span class="alum-section-rail__text"></span></span>`;
      a.querySelector('.alum-section-rail__text').textContent = label;
    } else {
      a.textContent = label;
    }
    if (path === href) a.classList.add('is-active');
    return a;
  }

  const topNav = document.createElement('nav');
  topNav.className = 'alum-project-nav';
  topNav.setAttribute('aria-label', 'Alüm quick navigation');
  const brand = document.createElement('a');
  brand.className = 'alum-project-nav__brand';
  brand.href = LANDING_PAGE;
  brand.setAttribute('aria-label', 'Back to CAST Build landing page');
  brand.innerHTML = projectLogo
    ? `<img src="${projectLogo}" alt="CAST Build"><span class="alum-project-mark__name">${projectName}</span>`
    : `<span class="alum-project-nav__wordmark" aria-label="CAST Build"><span>CAST</span><strong>BUILD</strong></span><span class="alum-project-mark__name">${projectName}</span>`;
  const topLinks = document.createElement('div');
  topLinks.className = 'alum-project-nav__links';
  for (const [label, href] of primary) topLinks.appendChild(link(label, href));
  const assistantSlot = document.createElement('div');
  assistantSlot.className = 'alum-project-nav__assistant-slot';
  assistantSlot.setAttribute('aria-label', 'CAST team assistant');
  topNav.append(brand, topLinks, assistantSlot);

  loadAuthGate();
  loadGlobalIntakeAssets().then((intake) => {
    if (intake && intake.mountButton) intake.mountButton(topNav);
  });
  loadTeamAssistant().then((assistant) => {
    if (assistant && assistant.mount) assistant.mount();
  });

  const rail = document.createElement('aside');
  rail.className = 'alum-section-rail';
  rail.setAttribute('aria-label', 'Alüm page sections');
  const railBrand = document.createElement('a');
  railBrand.className = 'alum-section-rail__brand';
  railBrand.href = HOME;
  railBrand.setAttribute('aria-label', 'Back to Alüm Project Home');
  railBrand.innerHTML = `<span class="alum-section-rail__project-name">${projectName}</span>`;
  rail.appendChild(railBrand);
  for (const group of groups) {
    const heading = document.createElement('div');
    heading.className = 'alum-section-rail__group';
    heading.textContent = group.label;
    rail.appendChild(heading);
    if (group.summary) {
      const summary = document.createElement('div');
      summary.className = 'alum-section-rail__summary';
      summary.textContent = group.summary;
      rail.appendChild(summary);
    }
    const tabs = document.createElement('div');
    tabs.className = 'alum-section-rail__tabs';
    for (const [label, href, icon] of group.items) tabs.appendChild(link(label, href, 'alum-section-rail__link', icon));
    rail.appendChild(tabs);
  }
  const note = document.createElement('p');
  note.className = 'alum-section-rail__note';
  note.textContent = 'Read-first project controls. Use CAST BUILD A.O for source-system writes.';
  rail.appendChild(note);

  document.body.classList.add('alum-project-nav-spacer');
  document.body.insertBefore(topNav, document.body.firstChild);
  document.body.insertBefore(rail, topNav.nextSibling);
})();
