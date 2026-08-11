# Mobile design QA

## Scope and visual truth

This pass covers the Expo/Android Discover home, category discovery, and app-detail surfaces. The implementation intentionally borrows the restrained, dark editorial hierarchy of the supplied Solana Mobile Store references while using an independent Hub identity, explicit trust language, and functional catalogue filters.

Source visual truth:

- Home: `C:/Users/loicd/Pictures/store/Screenshot_20260807-214837.png`
- Category list: `C:/Users/loicd/Pictures/store/Screenshot_20260808-013825.png`
- App detail: `C:/Users/loicd/Pictures/store/Screenshot_20260807-214915.png`

Implementation evidence:

- Home: `.artifacts/design-qa/mobile-home-final2.png`
- Category, all apps: `.artifacts/design-qa/mobile-category-final.png`
- Category, Games filters: `.artifacts/design-qa/mobile-games-final.png`
- App detail: `.artifacts/design-qa/mobile-detail-v2.png`
- Home comparison: `.artifacts/design-qa/qa-home-comparison.png`
- Category comparison (final copy): `.artifacts/design-qa/qa-category-comparison-final.png`
- Detail comparison: `.artifacts/design-qa/qa-detail-comparison.png`
- Focused hero: `.artifacts/design-qa/qa-home-hero-focus.png`
- Focused filters: `.artifacts/design-qa/qa-category-filters-focus.png`
- Focused install state: `.artifacts/design-qa/qa-detail-cta-focus.png`

## Capture normalization and state

- Runtime: Android API 36 emulator, real Expo native development build, Hermes, Metro bundle loaded through `adb reverse tcp:8081 tcp:8081`.
- Implementation viewport: 1080 x 2424 pixels, default emulator font scale.
- Reference screenshots were normalized to 1080 x 2424 only for the side-by-side composites; the original screenshots remain untouched.
- Home state: local catalogue loaded, production-style independent-brand copy, generated Hub hero visible.
- Category state: All apps shows the single indexed fixture; Games demonstrates the active category filter and its truthful empty result. Both retain the status/trust filters and recently-updated sort.
- Detail state: catalogue target is v1 while the locally installed fixture is v2.0.0, so downgrade navigation is disabled and the screen says `Newer version installed`.
- The current fixture has category `other` and no publisher screenshots. Games therefore has a valid empty result, and app detail uses the branded fallback artwork. This is a data condition, not a rendering defect.

## Full-view comparison findings

- Typography: passed. Oversized headings, compact eyebrow labels, and strong app-title hierarchy preserve the reference's editorial rhythm without copying its brand.
- Spacing and layout: passed. Large touch targets, generous vertical rhythm, rounded editorial card, and persistent tab bar remain readable at the target viewport.
- Color: passed. Deep green-black surfaces, mint interaction color, amber preview state, and neutral trust states are consistent and distinguish evidence types without implying Solana Mobile affiliation.
- Image quality: passed. Launcher, hero, and fallback artwork are correctly cropped and remain sharp at device density. Broken remote publisher icons fall back to `hub-app-fallback.png` through `onError`.
- Copy and content: passed. `Available now` replaces unsupported featured claims; preview, approval, consent, and authenticity are kept separate; singular/plural indexed-app copy is correct.
- Icons: passed. Expo-supported symbol icons are used consistently; there are no emoji or text-character icon placeholders.
- Accessibility: passed for the implemented pass. Controls expose labels/selected state in the Android accessibility tree, contrast is legible, and primary controls meet practical touch-size expectations.
- Interactions: passed. Home-to-category navigation, category switching, install-status selection, app-card navigation, and back navigation were exercised on the emulator. Search/status/trust/sort behavior is also covered by unit tests.

## Focused-region findings

- Hero: the final capture shows the generated editorial art, dark content scrim, readable supporting copy, and a clear `Explore with filters` action.
- Category controls: search, category jump, install state, trust evidence, and truthful sort choices fit in the expected hierarchy. Cross-app Android `versionCode` sorting is deliberately absent because it is not meaningful across packages.
- Detail CTA and trust facts: installed-version state is derived from package-local `versionCode`; absent, update, current, and newer-installed states have distinct outcomes. Four trust facts remain visually and semantically independent.

## Comparison history

1. P0 runtime — Hermes did not support `Array.prototype.toSorted`, causing a red-screen load failure. Replaced it (and other avoidable newer-array/string helpers) with Hermes-compatible operations, reloaded the real bundle, and confirmed no current ReactNativeJS error.
2. P1 safety/copy — catalogue v1 with installed v2 initially showed `Install securely`. Added a pure version-state mapper and disabled downgrade navigation; the final detail capture now shows `Newer installed` and `Newer version installed · 2.0.0`.
3. P2 legibility — hero support copy competed with the generated art. Added a localized dark scrim and recaptured the final Home screen.
4. P2 truthfulness — replaced an unsupported featured-release claim with `Available now`, selecting the most recently updated eligible item.
5. P2 robustness — remote artwork previously had no failure path. Added URL-change reset and `onError` fallback to the real Hub fallback asset.
6. P2 copy — fixed indexed-app pluralization; the final category capture and final category composite show `1 app indexed`.

## Verification

- `pnpm --filter @hub/mobile typecheck`: passed
- `pnpm --filter @hub/mobile lint`: passed
- `pnpm --filter @hub/mobile test`: passed (3 files, 10 tests)
- Emulator runtime and Android accessibility-tree interaction checks: passed

Residual P3: a richer real catalogue will improve category and detail visual coverage because the current single fixture has neither a publisher screenshot nor a Games classification. The filter and empty-state behavior already handles that condition correctly.

# Web publisher wallet-selection QA

## Scope and visual truth

This pass covers the redesigned publisher authentication control. The requested product change is intentional rather than a pixel-for-pixel clone: replace the always-visible wallet dropdown plus separate submit button with one clear CTA, then reveal an accessible wallet chooser only when more than one compatible wallet is available.

Source visual truth:

- Existing two-control state: `C:/Users/loicd/AppData/Local/Temp/codex-clipboard-70c939fb-9285-4443-8d13-9cfccf4c2018.png`

Implementation evidence:

- Desktop open dialog: `output/playwright/wallet-picker-desktop.png`
- Mobile open dialog: `output/playwright/wallet-picker-mobile.png`
- Combined before/after comparison: `output/playwright/wallet-picker-comparison.png`

## Capture normalization and state

- Runtime: optimized Next.js production build with a non-secret design-QA Helius placeholder so the publisher client renders locally.
- Source: 491 x 296 pixels, existing desktop open-select state.
- Desktop implementation capture: 1280 x 900 CSS-pixel viewport, open wallet-dialog state.
- Mobile implementation capture: 390 x 844 CSS-pixel viewport, open wallet-dialog state, screenshot scale `css`.
- Comparison: the source is shown at its native aspect ratio and the implementation at a contained 390 x 844 CSS-pixel capture. No density-based fidelity claims are made because this is a workflow redesign, not a same-state replica.
- Wallet images in QA came from the locally installed Phantom and MetaMask extensions. Production renders the icon data supplied by each registered Wallet Standard wallet.

## Full-view and focused comparison findings

- Typography: passed. The chooser follows the existing Hub eyebrow/title/supporting-copy hierarchy and keeps wallet names scannable.
- Spacing and layout: passed after one iteration. The dialog fits within a 390 x 844 viewport, primary wallet rows retain practical touch height, and the auth CTA becomes full-width on narrow screens.
- Color and tokens: passed. Existing surface, line, text, muted, and mint tokens are reused; the modal does not introduce a competing visual language.
- Image quality: passed. Wallet-reported raster icons render at 42 x 42 without distortion and use a consistent rounded mask.
- Copy and content: passed. The UI states that the next action is a one-time authentication signature and not a transaction. Authentication remains explicitly separate from distribution consent.
- Interaction: passed. Multiple wallets open the chooser; one wallet proceeds directly to its connect callback; Escape closes the chooser and restores focus; Shift+Tab wraps within the dialog; mobile and desktop layouts remain usable.
- Accessibility: passed for the implemented scope. The chooser exposes `role=dialog`, `aria-modal`, a labelled heading, deterministic initial focus, keyboard focus containment, Escape dismissal, and trigger-focus restoration.

Focused comparison was needed because the source only contains the publisher-authentication region. `wallet-picker-comparison.png` places that source next to the implemented modal state and shows the intended reduction from two persistent controls to one progressive-disclosure action.

## Comparison history

1. P1 layout — the existing sticky status banner overlapped the publisher form on desktop and the connect control on mobile. It was changed to participate in normal document flow, then the mobile accessibility tree was recaptured with no overlap.
2. P2 accessibility — the initial dialog focused the first wallet but did not contain keyboard focus. Added first/last focus wrapping and verified backward tabbing from Cancel reaches the final wallet instead of leaving the dialog.
3. P2 responsive hierarchy — wallet choice rows originally retained a redundant trailing `Continue` label on the narrow layout. The label is hidden below 520px while each full row remains the button and carries the complete accessible name.

## Verification

- `pnpm --filter @hub/web typecheck`: passed
- `pnpm --filter @hub/web lint`: passed
- `pnpm --filter @hub/web test`: passed (3 files, 12 tests)
- `pnpm --filter @hub/web build`: passed
- Browser console: 0 errors, 0 warnings
- Primary interactions: multi-wallet open, Escape dismissal, focus restoration, backward focus wrap, and single-wallet direct-connect branch exercised

Residual P3: the external wallet extension's own approval window is controlled by each wallet and was not automated in this visual QA pass. The Hub still uses the same Wallet Standard connect and exact-message-signature APIs that were already exercised by the real publisher flow.

final result: passed

# App detail navigation and preview rail - design QA

## Scope and source visual truth

This pass corrects the public app-detail rhythm and gallery behavior without changing publisher media. It also makes the selected navigation destination visible, removes the vague public `More` category, and withdraws the non-promotable Hub fixture from the live catalogue.

Source references:

- User-reported preview rail before correction: `C:/Users/loicd/AppData/Local/Temp/codex-clipboard-6245e482-11d2-430f-a721-a48d03771533.png` (1404 x 767 pixels).
- User-reported detail intro before correction: `C:/Users/loicd/AppData/Local/Temp/codex-clipboard-6cdd15e9-b8a3-4f65-98d5-8bf72c566904.png` (1419 x 312 pixels).

Implementation evidence at a 1404 x 900 CSS-pixel browser viewport:

- Production detail intro and active navigation: `.artifacts/design-audit/nav-preview-fixes/06-production-top-after.png`.
- Production preview rail after a real mouse drag: `.artifacts/design-audit/nav-preview-fixes/07-production-preview-after-drag.png`.
- Production before captures: `.artifacts/design-audit/nav-preview-fixes/01-production-top-before.png` and `02-production-full-before.png`.

## Visible comparison

- Navigation: passed. The current route is now a clearly selected blue-grey pill with `aria-current="page"`; catalogue remains selected on app-detail routes.
- Intro spacing: passed. The install action block has a 32 CSS-pixel desktop separation from the banner and no longer appears glued to the artwork.
- Screenshot proportions: passed. Portrait screenshots keep their intrinsic ratio with `object-fit: contain`, use a taller responsive height, and no longer crop their lower content.
- Gallery presentation: passed. The native scrollbar is hidden, grab/grabbing affordances are visible, and the rail retains the source art without stretching.
- Public taxonomy: passed. `More` is absent from web and Android category navigation; unclassified records remain discoverable through All apps under the internal `other` fallback.

## Interaction and data verification

- Mouse swipe: passed on the production domain. Dragging the rail moved `scrollLeft` from 0 to 292 CSS pixels.
- No reordering: passed. The exact ordered screenshot URL array was identical before and after the drag; the interaction only changes horizontal scroll position.
- Touch and keyboard: the rail uses pointer events with horizontal touch handling and retains left/right keyboard scrolling when focused.
- Fixture isolation: passed. Production `hub.apps.distribution_enabled` is false for `com.lololabs.hubfixture`; the public catalogue returns DegenMerge only and no `hub-install-demo` record.
- Public categories: passed. Discover exposes All apps, Games, DeFi & trading, Wallets, DePIN, NFTs, Privacy & security, Content & streaming, Productivity, Social & identity, AI & agents, and Lifestyle; no `More` tile is rendered.
- Browser console: 0 errors on the final production app detail.
- Vercel deployment `dpl_ChM7Mjw5TRVMSYQJ74UnfkaumQ9N`: READY and aliased to `https://solana-hub.lololabs.xyz`.
- Repository `pnpm check`: passed across lint, typecheck, tests, and builds for all 12 packages.

## Comparison history

1. P1 image fidelity - replaced fixed-size cropped cards with intrinsic-ratio portrait previews.
2. P1 interaction - added a swipe-like pointer rail for mouse and touch; source order is immutable and never enters a drag-and-drop workflow.
3. P2 layout rhythm - added vertical breathing between publisher artwork and the install actions.
4. P2 orientation - replaced the visually neutral navigation with an explicit active state.
5. P2 taxonomy - removed the vague public `More` category while preserving safe fallback discoverability.
6. P1 catalogue truth - removed the non-promotable test fixture from production instead of presenting it as a real Productivity app.

final result: passed

# Blue Orbit catalogue and adaptive game filters - design QA

## Scope and visual direction

This pass turns the public experience into a consumer app store rather than a publisher-facing technical surface. It introduces a dedicated catalogue route, adaptive category filters, curated Hub classifications, and a blue / blue-grey visual system inspired by the user's Solana Mobile references without copying their brand assets.

Source and implementation evidence:

- User-provided Solana Mobile category and app-detail screenshots in the current project thread.
- Stitch Games reference: `.artifacts/design-qa/blue-orbit/stitch-games-reference.png`.
- Web home: `.artifacts/design-qa/blue-orbit/web-home-desktop.png`.
- Web Games catalogue: `.artifacts/design-qa/blue-orbit/web-catalog-games-desktop.png` and `.artifacts/design-qa/blue-orbit/web-catalog-games-mobile.png`.
- Production Puzzle result: `.artifacts/design-qa/blue-orbit/web-live-games-puzzle-mobile.png`.
- Android home, Games, filters, and Puzzle state: `.artifacts/design-qa/blue-orbit/mobile-home-final.png`, `mobile-games-final.png`, `mobile-games-filters-final.png`, and `mobile-games-puzzle-live-final.png`.

## Comparison and product checks

- Visual hierarchy: passed. The Blue Orbit palette replaces the previous dominant mint with deep ink, blue-grey surfaces, periwinkle actions, and restrained cyan highlights.
- Store positioning: passed. Consumer discovery, artwork, categories, and app cards lead; technical trust details remain available where they help an installation decision.
- Category navigation: passed. Homepage category tiles navigate to the dedicated `/catalog` page instead of silently changing content below the fold.
- Adaptive filtering: passed. Games exposes genre, search, trust, installation status, and sorting. Simple categories such as Wallets omit genre controls.
- Classification correctness: passed. DegenMerge is curated as Games / Casual / Puzzle and no longer falls back to Other tools. Publishers can submit their own category and game genres, while Hub curation remains an explicit source.
- Empty and loading states: passed. Counts are scoped to the active category, active filters are visible, and zero-result copy only offers reset actions when a filter is actually active.
- Responsive behavior: passed on desktop web, narrow web, and Pixel 9 API 36.
- Accessibility and interaction: passed for category links, filter chips, selects, search, filter sheet, and catalogue cards.

## Verification

- Repository `pnpm check`: passed across all 12 packages.
- Supabase production migration: applied; RLS and security advisors clean.
- Production catalogue: Games + Puzzle returns DegenMerge with real artwork and metadata.
- Android Pixel 9 API 36: Home, Games, Puzzle, filter sheet, and Wallets verified against the production API.
- Android Hub 0.2.0 ARM64 APK: 47,777,435 bytes; SHA-256 `625D4529AC3229DBF38B6EE7695647A006AFA9C91DBE09055490FA3C8F22D1C4`.
- APK configuration: min SDK 26, target SDK 36, arm64-v8a, APK Signature Scheme v2, `REQUEST_INSTALL_PACKAGES` present, and `QUERY_ALL_PACKAGES` absent.
- Public APK endpoint: HTTP 200, Android package MIME type, attachment disposition, and byte-for-byte matching SHA-256.
- Vercel production deployment: READY; `/download` displays version 0.2.0, the matching hash, and the new public APK URL.
- Production browser console and Vercel error log check: no errors found.

Residual P3: version 0.2.0 is intentionally labeled early access and still uses the development Android signer. A future permanently signed stable build can require uninstalling this test edition once.

final result: passed

# Publisher storefront media — design QA

## Scope and evidence

This pass verifies the consumer storefront path from official Solana Mobile Release NFT metadata through Supabase, the public catalogue API, the production website, and the standalone Android Hub. Publisher media is used as supplied; Hub fallback art appears only when a release has no suitable artwork.

Source visual truth:

- Solana Mobile Store home: `C:/Users/loicd/Pictures/store/Screenshot_20260807-214837.png`
- Solana Mobile Store app detail: `C:/Users/loicd/Pictures/store/Screenshot_20260807-214915.png`
- DegenMerge Release metadata: official icon, four screenshots, 1200 × 600 banner, and 1200 × 1200 feature graphic from the Release NFT metadata.

Implementation evidence:

- Web production home, 1440 × 1000 CSS pixels: `.artifacts/design-qa/web-storefront-home-production-final.png`
- Web production detail, 1440 × 1000 CSS pixels: `.artifacts/design-qa/web-storefront-detail-production-final.png`
- Web production detail, 390 × 844 CSS pixels: `.artifacts/design-qa/web-storefront-detail-production-mobile-final.png`
- Android production-data home, Pixel 9 API 36 at 1080 × 2424 device pixels: `.artifacts/design-qa/mobile-storefront-home-production-final.png`
- Android production-data detail: `.artifacts/design-qa/mobile-storefront-detail-production-final.png`
- Android production-data screenshot gallery: `.artifacts/design-qa/mobile-storefront-gallery-production-final.png`

## Visible comparison

- Typography: passed. The large editorial app title, concise store summary, and section hierarchy follow the supplied store references while retaining the Hub identity.
- Layout and spacing: passed. Real banner art leads both web and Android detail pages, the app icon overlaps the cover, the primary action remains visible, and four portrait screenshots form a scannable gallery.
- Color and artwork: passed. DegenMerge artwork now defines each feature surface; no generic Hub hero is shown when official release media exists. Dark scrims keep text readable without obscuring the source art.
- Content: passed. Official localized resource identifiers are resolved through the preferred release locale, so the UI displays the real short and long descriptions instead of the raw `5`/`1` keys.
- Trust language: passed. Development preview, publisher control, consent, binary authenticity, and Solana Mobile approval remain distinct and visible. The consumer presentation does not turn preview status into an approval claim.
- Responsive behavior: passed after correcting the mobile web app-title wrapping and hero sizing. No horizontal overflow remains at 390 × 844.

## Data and interaction verification

- Production API returns one DegenMerge record with the official icon, banner, feature graphic, four screenshots, full localized summary, and `previewOnly: true`.
- Home → app detail navigation works on the production website and Android emulator.
- Catalogue search for `Degen` returns exactly DegenMerge with the real summary and artwork.
- Web detail renders four accessible preview images and the localized long description.
- Android detail renders the banner, icon, four-image gallery, trust facts, permissions, and secure install entry.
- Browser console: 0 errors, 0 warnings.
- Vercel production deployment: READY; post-deploy error log scan returned no errors.
- Supabase security advisors: 0 findings. Performance advisors contain only expected low-traffic unused-index informational notices.
- Full repository `pnpm check`: passed. Android x86_64 release build and Pixel 9 API 36 installation: passed.
- Physical-phone artifact: ARM64 release build passed from the same locked commit; APK Signature Scheme v2, 16 KiB zip alignment, min SDK 26, target SDK 36, and `QUERY_ALL_PACKAGES` absence were verified.

## Iterations

1. P0 data correctness — JSONB values written through postgres.js were encoded as JSON string scalars, causing the API to discard screenshots. Added typed JSON writes, a repair migration, and backfilled release media columns.
2. P1 content correctness — official `localized_resources` values are translation identifiers. Added locale resolution through `extensions.i18n`, then corrected the existing DegenMerge record.
3. P1 consumer presentation — replaced generic feature art with the publisher banner/feature graphic on home, cards, and app detail; added the complete screenshot gallery to web and Android.
4. P2 responsive polish — corrected mobile title wrapping and cover proportions after source/implementation comparison.
5. P2 production verification — deployed the exact tested commit, exercised search and detail navigation, reloaded Android against the production API, and confirmed the repaired data remains an object after deployment.

final result: passed

# Hub download, Android banner, and launcher icon — design QA

## Scope and source visual truth

This pass covers three connected consumer-facing issues: making Android Hub discoverable from the website, allowing an explicitly less-trusted direct APK download for desktop transfer, matching the publisher banner's intended proportion on Android, and removing the launcher's legacy white icon wrapper.

Source visual truth:

- User-reported Android Hub detail before correction: `C:/Users/loicd/AppData/Local/Temp/codex-clipboard-14f29c78-fb43-4538-a171-f20e2bb7d0b1.png`
- Solana Mobile Store DegenMerge reference: `C:/Users/loicd/AppData/Local/Temp/codex-clipboard-9d60f313-bf37-4e95-a25b-f27f3b17098a.png`
- User-reported launcher icon before correction: `C:/Users/loicd/AppData/Local/Temp/codex-clipboard-9892b1c0-17f5-4c9a-a31d-1799decd0027.png`

Implementation evidence:

- Android detail after correction: `.artifacts/design-qa/mobile-detail-banner-final.png`
- Android launcher after correction: `.artifacts/design-qa/mobile-launcher-icon-final.png`
- Web Hub-download page at 390 × 844 CSS pixels: `.artifacts/design-qa/web-download-mobile-final.png`
- Web Hub-download page at 1440 × 1000 CSS pixels: `.artifacts/design-qa/web-download-desktop-final.png`
- Web app detail with both install paths at 390 × 844 CSS pixels: `.artifacts/design-qa/web-app-detail-download-mobile.png`

## Capture normalization and state

- Solana Mobile reference file: 280 × 622 pixels. Android implementation: Pixel 9 API 36 at 1080 × 2424 device pixels. Both have effectively the same tall-screen aspect ratio; comparison is based on relative cover/body proportions rather than unscaled pixel measurements.
- Launcher source file: 263 × 281 pixels. Final launcher evidence: 1080 × 2424 device pixels. A focused icon-region comparison was used because the surrounding launcher layouts differ.
- Web screenshots use explicit 390 × 844 and 1440 × 1000 CSS-pixel browser viewports. No density normalization was needed for the web captures.
- State: DegenMerge development preview loaded from the real production catalogue; Android Hub 0.2.0 early-access download enabled; app-detail direct publisher APK link visible.

## Full-view and focused comparison

- Typography: passed. The existing Hub display hierarchy remains intact, the new download page uses the same optical weights, and long explanatory copy stays readable at 390 CSS pixels.
- Spacing and layout rhythm: passed after correction. The Android publisher banner now uses its native 2:1 slot rather than a fixed 290dp crop; the icon/body overlap remains deliberate and the secure-install CTA stays above the fold.
- Colors and visual tokens: passed. The new web route reuses the existing ink, surface, mint, line, radius, and action tokens. The early-access status is informational and does not imitate a verification badge.
- Image quality and asset fidelity: passed. The publisher's banner, icon, and screenshots remain untouched. Android adaptive-icon configuration removes the launcher-generated white wrapper while preserving the supplied Hub artwork and mask behavior.
- Copy and content: passed. “Install with Android Hub” is the recommended path; “Download APK directly” is clearly advanced and explicitly states which local checks it skips. The Hub download page explains why browser-only validation cannot inspect installed package, signer, or downgrade state.
- Responsive behavior: passed. At 390 × 844, navigation remains usable, both primary actions fit without overflow, and the download page preserves the editorial hierarchy.
- Accessibility and interaction: passed for the implemented scope. Download links are semantic anchors with stable accessible names; the current Hub APK link resolves to the public ARM64 artifact; app-detail links expose distinct actions instead of one ambiguous CTA.

Focused comparison was required for the Android cover and launcher icon. The post-fix cover shows the complete 2:1 publisher composition at the same relative height as the supplied store reference. The launcher comparison shows the mark filling Android's circular mask with no legacy white container or undersized nested square.

## Comparison history

1. P1 imagery — the Android detail used a fixed 290dp cover height, forcing a strong crop of a 1200 × 600 publisher banner. Replaced it with a width-bound 2:1 slot and recaptured DegenMerge on Pixel 9.
2. P1 launcher identity — Android treated the single legacy icon as a nested icon and added a large white adaptive wrapper. Added an explicit adaptive foreground and matching Hub background color, rebuilt the native app, and verified the launcher result on Pixel 9.
3. P1 product discovery — the website referred to Android Hub without a route or download. Added persistent “Get the Hub” navigation, a dedicated explanation/install page, a real ARM64 early-access artifact, and a separate advanced direct-download path on app pages.
4. P2 trust copy — the initial website CTA implied all installation validation happened elsewhere without explaining why. Added exact on-device responsibilities and made the reduced guarantees of direct desktop transfer visible beside both download surfaces.
5. P2 mobile navigation — the first responsive label workaround duplicated the link's accessible name. Replaced it with one stable “Get the Hub” label and rechecked the browser accessibility snapshot.

## Verification

- Web production build, typecheck, lint, and 12 tests: passed.
- Mobile x86_64 release build, emulator installation, typecheck, lint, and 10 tests: passed.
- ARM64 early-access release build: passed from a short Windows build path.
- ARM64 APK: 47,777,435 bytes; SHA-256 `625D4529AC3229DBF38B6EE7695647A006AFA9C91DBE09055490FA3C8F22D1C4`; APK Signature Scheme v2 verified; min SDK 26; target SDK 36; arm64-v8a only.
- APK permissions: `REQUEST_INSTALL_PACKAGES` present; `QUERY_ALL_PACKAGES` absent.
- Public APK endpoint: HTTP 200 with Android package MIME type, attachment disposition, and exact 47,777,435-byte content length.
- Browser console: 0 errors on the final responsive download page.
- Primary interactions checked: global Hub navigation, catalogue fallback, Hub APK href, direct publisher APK href, and app-detail route.

Residual P3: the current Hub APK intentionally uses the development signer. The page labels it early access; the first permanently signed stable build may require reinstalling this test edition.

final result: passed
