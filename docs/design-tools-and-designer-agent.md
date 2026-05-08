# CAST Design Tools + DESIGNER Agent

## Recommended design stack for CAST

### 1. Figma — source of truth for design system
Best for layouts, components, typography, color systems, and design review. Use it as the canonical visual standard for CAST Build, CAST Development, and CAST OS.

### 2. Vercel v0 — fast production-style UI exploration
Best for generating React/UI ideas quickly and translating design direction into component language. Useful for exploring dashboards, cards, tables, and navigation systems before we code them into the static platform.

### 3. Framer — polished marketing/prototype layer
Best for high-end interactive landing pages and marketing prototypes. Useful if CAST wants a refined public-facing experience separate from the internal app.

### 4. Relume — sitemap + wireframe planning
Best for quickly organizing site architecture before visual design. Useful when the portal is getting too many pages and needs cleaner information architecture.

### 5. Mobbin / Page Flows — inspiration library
Best for seeing how excellent products handle navigation, dashboards, onboarding, command centers, and financial/admin workflows.

### 6. Storybook — component catalog when CAST UI matures
Best once the design system has reusable components. Lets us document and test cards, nav, tables, badges, filters, and page shells.

### 7. Playwright + Agent Browser — actual click-flow testing
Best for verifying what Lawrence is noticing: links moving people around unexpectedly, dead-end pages, broken routes, and inconsistent navigation.

### 8. axe DevTools + Lighthouse — accessibility and baseline quality
Best for quick checks on contrast, labels, keyboard behavior, performance, and obvious accessibility issues.

### 9. Percy or Chromatic — visual regression testing
Best after the UI stabilizes. These catch “why did this page suddenly look weird?” problems before deployment.

### 10. Microsoft Clarity / Hotjar — real-user behavior review
Best once users are actively using the platform. Shows rage clicks, confusing flows, scroll depth, and where users get stuck.

## Recommended CAST setup

Start with this practical stack:

1. Figma — design source of truth.
2. Vercel v0 — rapid UI ideas.
3. Relume — IA/sitemap cleanup.
4. Agent Browser + Playwright-style smoke tests — click-flow validation.
5. axe/Lighthouse — accessibility/performance sanity checks.
6. Percy/Chromatic later — visual regression once the design stabilizes.

## DESIGNER agent

DESIGNER is the CAST visual design and UX audit agent.

### Mission

Make CAST interfaces look polished, intentional, and easy to use. DESIGNER audits:

- Visual hierarchy
- Navigation clarity
- Page architecture
- Spacing, typography, rhythm, and alignment
- Responsive behavior
- Accessibility basics
- Component consistency
- Dead-end flows and broken click paths

### Definition of done

A DESIGNER pass is complete when:

1. Primary navigation is consistent and recoverable from every page.
2. Current location is obvious.
3. Links go where users expect.
4. Important content is grouped logically.
5. The page looks clean at common viewport sizes.
6. Duplicate/conflicting nav systems are removed.
7. Tests/build pass.
8. Live browser smoke confirms the deployed result.

### CAST Build application

For the Alüm portal, DESIGNER should especially watch:

- Left-side navigation structure.
- Top-left return-to-project-home link.
- Budget/financial page consistency.
- Command Center → modules → return flow.
- Whether specialist pages feel nested under clear categories instead of scattered across the site.
