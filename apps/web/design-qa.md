# Public web redesign — design QA

## Evidence

- References: `C:/Users/loicd/Pictures/store/Screenshot_20260807-214837.png`, `Screenshot_20260807-214906.png`, `Screenshot_20260807-214915.png`, and `Screenshot_20260808-013825.png`.
- Implemented views: `apps/web/.qa/catalogue-desktop-final.png`, `catalogue-mobile-final.png`, `catalogue-mobile-categories-final-2.jpg`, `app-detail-mobile-final.png`, and `app-detail-mobile-info-final.png`.
- Comparison sheets: `apps/web/.qa/home-comparison.png`, `detail-comparison.png`, and `categories-comparison.png`.
- Viewports: desktop 1440 × 1000; mobile 393 × 852. The supplied Android references are device-density screenshots, so comparisons normalize their displayed height rather than raw pixels.

## Visual comparison

- Typography: the reference hierarchy (oversized display heading, compact metadata, clear action pills) is preserved with a distinct Hub voice. Long category labels wrap cleanly.
- Spacing and layout: the home hero, editorial cards, sticky navigation, app icon overlap, and detail information rhythm stay legible at desktop and mobile breakpoints. Mobile categories use a two-column scan pattern to avoid reproducing the source store's endless-list problem.
- Color: deep ink/teal surfaces retain the reference's calm dark-store feel, while mint, coral, lilac, blue, and amber establish an independent Hub identity.
- Image quality: the generated Hub mark, editorial hero, and APK fallback are crisp at their rendered sizes. Publisher-provided images remain direct metadata URLs; they are not routed through an unrestricted image proxy.
- Copy and trust: no affiliation or unsupported editorial ranking is implied. “Latest eligible release” replaces featured claims, and publisher control, consent, binary authenticity, and Solana Mobile approval remain separate facts.

## Interaction and accessibility checks

- Search, category selection, trust filter, Android compatibility filter, sort, reset, and app-detail navigation were exercised against the production build.
- The Games tile and quick-filter chip set the same category state and update `aria-pressed`; the catalogue moves into view after tile selection.
- Empty states remain actionable, focus rings are visible, controls have labels/roles, and no browser console errors were observed.
- Production build verified at `http://127.0.0.1:3000`.

## Iterations

- Fixed mobile hero copy/action overlap by increasing the mobile art region and adding a dedicated dark copy panel.
- Fixed stale development-bundle interaction behavior by verifying the optimized production build.
- Restored a two-column mobile category grid after comparison showed that a one-column grid reintroduced unnecessary discovery length.

## Result

passed
