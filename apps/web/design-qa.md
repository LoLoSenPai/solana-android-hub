# OLED / chromatic hardware redesign — design QA

## Source truth and evidence

- Visual references: `C:/Users/loicd/Pictures/store/1.png`, `2.png`, and `3.png`.
- Implemented desktop captures: `apps/web/.qa/home-desktop-final.png`, `games-desktop-final.png`, and `detail-desktop-final.png`.
- Implemented mobile captures: `apps/web/.qa/home-mobile-final.png`, `games-mobile-final.png`, and `detail-mobile-final.png`.
- Side-by-side comparison sheets: `apps/web/.qa/compare-home.png`, `compare-games.png`, and `compare-detail.png`.
- Category-carousel correction evidence: `apps/web/.qa/compare-category-overflow-fix.png`, `category-carousel-2k-final.png`, and `mobile-category-carousel-final.png`.
- Desktop viewport: 1440 × 1000. Mobile verification viewport: 393 × 852.
- Reference dimensions: 1452 × 1080. Desktop comparisons normalize the references to a 1440 px display width. The responsive mobile layouts are a product-consistent extrapolation because the selected desktop references did not include mobile screens.

## States verified

- Discover: neutral Hub artwork, consumer-oriented value proposition, catalogue search, categories, app cards, install flow, and trust explainer.
- Games: category selected, search, trust/sort controls, genre filters, empty state, clear action, growing-catalogue message, and app navigation.
- DegenMerge detail: real icon, app metadata, safe-install and direct-download actions, uncropped banner, 3-step Android flow, screenshots rail, release facts, permissions, and trust facts.

## Visual comparison and iteration history

- The first homepage pass made the hero too tall relative to the catalogue entry point. The desktop hero and heading were reduced; the search panel is now visible in the initial 1440 × 1000 viewport and categories start immediately below it.
- The first mobile category rail produced horizontal page overflow. Mobile margins and rail padding were corrected; measured `scrollWidth` and `clientWidth` are both 378 px at the 393 px browser viewport.
- The filtered empty state initially showed two “Clear filters” actions. The heading-level action now appears only when results exist; the empty state exposes exactly one recovery action.
- The earlier app banner crop concern was fixed with a blurred real-image backdrop and a foreground image using `object-fit: contain`; no artwork is stretched or substituted.
- The final style uses a single lightweight metallic treatment for “Get the Hub”, a 115 KB generated WebP hero, static CSS gradients, and library icons. No WebGL or continuous shader effect was introduced.
- At 2048 × 1152, the original edge-to-edge category rail enlarged the document to its full intrinsic width. It is now a contained 1408 px carousel with a 3410 px internal scroll area; the document remains exactly 2033 px wide and has no page-level horizontal scrollbar.
- A mouse drag moved the desktop carousel from `scrollLeft: 0` to `854`; the mobile swipe moved it from `0` to `234`. Previous/next controls provide an accessible alternative.
- The category heading now uses the generated `hub-category-orbit.webp` artwork, optimized for the rendered slot rather than introducing twelve unrelated bitmap icons.

## Interaction, accessibility, and runtime checks

- Navigation, catalogue links, category state, Games genre selection, search, trust filter, sort, reset, app navigation, install/download links, and the screenshot rail were exercised locally.
- Games selection persists in the URL; the genre control updates `aria-pressed`; the screenshot rail moves with keyboard ArrowRight.
- Mobile navigation keeps the primary Catalogue and Get the Hub actions visible.
- Trust model becomes the active navigation item after its smooth-scroll jump. Discover and the logo return to the top and restore the Discover active state.
- No horizontal overflow was observed on Discover, Games, or app detail at desktop or mobile widths.
- Browser console verification returned zero errors and zero warnings.
- TypeScript, ESLint, Vitest, and the optimized Next.js production build pass.

## Final result

final result: passed
