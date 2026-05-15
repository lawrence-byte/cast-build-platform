# AGENTS.md

## Third-Party Script Guardrail

Before adding, editing, or enabling any analytics tag, pixel, tag manager, heatmap, product analytics, or third-party measurement script:

1. Check `docs/third-party-scripts.json` for a matching approval record.
2. Confirm the record lists the exact domain/script, ID/container/property, account owner, destination, named reader, approved-by/date, allowed environments, allowed scope, and privacy notes.
3. If Google Tag Manager is involved, confirm every transitive child tag loaded by the container is listed in the manifest. The GTM container alone is not enough.
4. If no approval exists, stop at an approval-ready proposal. Do not write the tag into source, config, env-driven templates, or deploy artifacts.
5. Run `npm run check:third-party-scripts` after building so source and production artifacts are both scanned.

CI must run the third-party script check on every pull request and deploy path.

