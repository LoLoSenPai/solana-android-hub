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
