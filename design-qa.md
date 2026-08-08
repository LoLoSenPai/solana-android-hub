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

final result: passed
