# OLED / chromatic hardware redesign — design QA

## Source truth and evidence

- Visual references: `C:/Users/loicd/Pictures/store/1.png`, `2.png`, and `3.png`.
- Implemented desktop captures: `apps/web/.qa/home-desktop-final.png`, `games-desktop-final.png`, and `detail-desktop-final.png`.
- Implemented mobile captures: `apps/web/.qa/home-mobile-final.png`, `games-mobile-final.png`, and `detail-mobile-final.png`.
- Side-by-side comparison sheets: `apps/web/.qa/compare-home.png`, `compare-games.png`, and `compare-detail.png`.
- Category-carousel correction evidence: `apps/web/.qa/compare-category-overflow-fix.png`, `category-carousel-2k-final.png`, and `mobile-category-carousel-final.png`.
- Category icon-set evidence: `apps/web/.qa/category-icon-set.png` and `category-icons-2k-final.png`.
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
- The final style uses a single lightweight metallic treatment for “Get the Hub”, a 115 KB generated WebP hero, static CSS gradients, and optimized generated imagery. No WebGL or continuous shader effect was introduced.
- At 2048 × 1152, the original edge-to-edge category rail enlarged the document to its full intrinsic width. It is now a contained 1408 px carousel with a 3410 px internal scroll area; the document remains exactly 2033 px wide and has no page-level horizontal scrollbar.
- A mouse drag moved the desktop carousel from `scrollLeft: 0` to `1139`; the mobile swipe moved it from `0` to `234`. Previous/next controls provide an accessible alternative.
- The decorative category-heading image was removed. Every category card now uses its own generated, optimized WebP icon from one consistent 3D glass-and-neon family; the twelve assets stay recognizable at their actual 91-104 px rendered size.
- Category cards use a fixed-height visual banner and a shared three-row content grid, so artwork, availability badges, titles, and descriptions align across the entire rail even when labels wrap.
- The four trust checks retain their concise copy while oversized low-contrast step numbers fill the previously empty upper area and reinforce scan order without competing with the content.

## Interaction, accessibility, and runtime checks

- Navigation, catalogue links, category state, Games genre selection, search, trust filter, sort, reset, app navigation, install/download links, and the screenshot rail were exercised locally.
- Games selection persists in the URL; the genre control updates `aria-pressed`; the screenshot rail moves with keyboard ArrowRight.
- Mobile navigation keeps the primary Catalogue and Get the Hub actions visible.
- Trust model becomes the active navigation item after its smooth-scroll jump. Discover and the logo return to the top and restore the Discover active state.
- No horizontal overflow was observed on Discover, Games, or app detail at desktop or mobile widths.
- Browser console verification returned zero errors and zero warnings.
- TypeScript, ESLint, Vitest, and the optimized Next.js production build pass.

## Process flow and category-index iteration

- Source visual truth: `C:/Users/loicd/AppData/Local/Temp/codex-clipboard-d671b465-cea3-4c36-a1c6-0f12da699868.png` and `codex-clipboard-6b8668fc-418b-47c4-9e7a-8ba350bd8a97.png`.
- Browser-rendered implementation evidence: `apps/web/.qa/flow-process-desktop-final.png`, `flow-process-mobile-final.png`, and `category-no-index-final.png`.
- Full focused comparison: `apps/web/.qa/compare-flow-process.png`, containing the source and final implementation in one normalized comparison image.
- Desktop comparison viewport: 1465 x 800 CSS px at density 1. Source pixels: 1465 x 379. The focused implementation region keeps the same 1465 px width; surrounding navigation and the following trust section are excluded from visual judgment.
- Responsive verification viewport: 393 x 852 CSS px at density 1. The document and content widths both measured 378 px, with no page-level horizontal overflow.
- Earlier finding: the three process cards had large unused areas, tiny step numbers, and generic library icons, so their relationship read as three unrelated facts rather than a sequence.
- Fix applied: each card now uses a large low-contrast number, a standalone transparent 3D process illustration, a consistent bottom-aligned copy block, and a real arrow icon between adjacent steps. On mobile the arrows rotate downward to preserve the sequence.
- Category correction: the decorative `01-12` corner indexes were removed from every carousel card. Availability badges, artwork, titles, and descriptions retain their shared alignment grid.
- Fonts and typography: the existing display hierarchy, weights, wrapping, and body line heights remain consistent; the new large numbers are deliberately subordinate through low opacity.
- Spacing and layout rhythm: the three equal tracks, fixed visual zones, bottom-aligned copy, connector placement, and mobile stacking remain balanced at desktop and mobile widths.
- Colors and visual tokens: the new assets use the existing OLED navy, blue, and violet palette; arrows and numbers use existing border and accent tokens.
- Image quality and asset fidelity: the three custom assets are transparent WebP cutouts generated in one material family, with transparent corners validated and no containing tiles or placeholder graphics.
- Copy and content: all existing process titles and explanatory copy remain unchanged.
- Post-fix result: no actionable P0, P1, or P2 findings. Both connectors render, all three image assets load, the category carousel still drags from `scrollLeft: 0` to `854`, and the browser console reports zero warnings or errors.

## Get the Hub installation-flow iteration

- Source visual truth: `C:/Users/loicd/AppData/Local/Temp/codex-clipboard-5c57e9e5-5da3-46cd-8ecf-0ebe484ddffb.png` and `codex-clipboard-6f229a4b-ee74-4a1e-a1f9-7f045a463975.png`.
- Browser-rendered implementation evidence: `apps/web/.qa/download-steps-final.png`, `download-device-card-final.png`, and `download-page-mobile-final.png`.
- Side-by-side focused comparisons: `apps/web/.qa/download-steps-compare.png` and `download-device-card-compare.png`; each sheet contains the source and final implementation in one normalized canvas.
- Desktop viewport: 1440 x 1100 CSS px at density 1. Source pixels: 1383 x 469 and 548 x 568. Focused implementation pixels: 1281 x 658 and 487 x 487. Mobile viewport: 393 x 852 CSS px at density 1; the captured document is 378 x 4497 px because the app shell reserves 15 px outside the content width.
- State: unauthenticated Get the Hub page with the public Hub APK unavailable, matching the supplied screenshots' informational installation state.
- Earlier findings: both three-step regions used tiny numbers, generic empty cards, and repeated row containers. The hierarchy did not match the richer visual language established on Discover, and the two sections looked like duplicated versions of the same simplistic component.
- Fix applied: the hero device card is now a connected vertical journey with a branded heading, three transparent installation illustrations, concise supporting copy, a luminous route line, and large low-contrast sequence numbers. The lower installation section uses three equal illustrated cards, oversized background numbers, and real arrow connectors; mobile rotates those connectors downward.
- Post-fix evidence: all six rendered image instances load at their intended 64 px and 180 px widths, the desktop page has no horizontal overflow, the mobile document and viewport both measure 393 px, and the browser console reports zero warnings or errors.
- Fonts and typography: the established display and body families remain unchanged; the new hierarchy uses the same optical weights and restrained uppercase eyebrow treatment. The ghost numbers are large enough to fill space without competing with the step titles.
- Spacing and layout rhythm: artwork, number, copy, and connectors occupy consistent zones. The device card no longer has repeated bordered rows; the lower cards align their illustrations and copy across equal tracks and stack cleanly on mobile.
- Colors and visual tokens: navy, cobalt, cyan, and violet remain aligned with the OLED/chromatic system. Borders and glows are controlled and do not introduce the former green-dominant visual language.
- Image quality and asset fidelity: three project-owned transparent WebP cutouts were generated from the existing process-icon style reference. Alpha edges, transparent corners, scaling, and sharpness were inspected; no tile backgrounds, placeholder symbols, or CSS-drawn illustrations remain.
- Copy and content: the installation requirements and Android security meaning remain intact. The compact device copy is shorter by design, while the detailed cards preserve the complete instructions.
- Interaction and responsiveness: navigation remains active on Get the Hub, the download and catalogue CTAs are unchanged, arrows indicate order without becoming controls, and reduced-motion behavior remains inherited from the global motion rule.
- Comparison history: the first mobile full-page capture revealed that below-the-fold images could remain unloaded during an instantaneous automated full-page capture. The three lightweight assets were switched to eager loading; the revised capture shows all artwork and the runtime confirms six of six image instances loaded.
- Findings: no actionable P0, P1, or P2 differences remain. The selected source was an intentionally sparse before-state, so the richer imagery and process treatment are the requested improvement rather than fidelity drift.

## Final result

final result: passed
