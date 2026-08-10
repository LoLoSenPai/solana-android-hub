# Android Hub blue-palette alignment — design QA

## Source truth and evidence

- Approved web art direction: `C:/Users/loicd/Pictures/store/1.png`, reinforced by the current production web palette.
- Earlier green-dominant Android capture: `.artifacts/design-qa/mobile-home-final.png` (1080 x 2424 px).
- Release `0.2.0` Android capture: `.artifacts/design-qa/mobile-blue-0.2.0.png` (1080 x 2424 px), captured from a Pixel 9 API 36 emulator after installing the standalone release APK.
- Same-canvas comparison: `.artifacts/design-qa/compare-mobile-green-blue.png` (2160 x 2424 px), old state left and release `0.2.0` right.
- Device viewport: 1080 x 2424 physical pixels. Both captures use the same emulator density and orientation, so no density normalization was needed.

## State verified

- Consumer Discover home loaded from `https://solana-hub.lololabs.xyz` with the real DegenMerge catalogue entry.
- Standalone staging package `com.lololabs.solanaandroidhub.dev`, version `0.2.0` / versionCode `2`.
- Existing installation updated in place with `adb install -r`; process launched successfully and logcat contained no fatal exception.

## Visual comparison

- Fonts and typography: the existing Android hierarchy, weights, wrapping, and optical sizes remain unchanged. Only accent color and updated consumer copy/data differ.
- Spacing and layout rhythm: search, editorial card, category grid, and tab bar retain the established geometry. No palette change introduced reflow or clipping.
- Colors and visual tokens: the former mint/green dominant accent is replaced by cobalt blue `#77A7FF`; canvas `#091018`, surfaces `#111B27`, raised cards `#172536`, and lines `#26384D` create the same OLED blue-black family as the web product. The legacy token name `mint` remains internal only and resolves to blue.
- Semantic colors: yellow/orange remains limited to Games and warning states; green remains only inside the shared Hub brand mark and genuine success semantics. It is no longer the interface's dominant accent.
- Image quality and asset fidelity: publisher artwork and the shared Hub logo remain sharp and unmodified; the palette pass does not recolor publisher-owned assets.
- Copy and content: the release uses the current consumer-oriented catalogue copy and real DegenMerge metadata from the production API.

## Runtime and security checks

- TypeScript and ESLint pass; 3 Vitest files / 12 tests pass.
- APK SHA-256: `B8FC998E3D51BDA4A2900921DA0E13F5AB1E454B26F783018F9631DFC74B17F9`.
- APK signer verification and zip alignment pass; native ABIs are `arm64-v8a` and `x86_64`.
- Min SDK 26, target/compile SDK 36, `REQUEST_INSTALL_PACKAGES` present, `QUERY_ALL_PACKAGES` absent.
- Embedded bundle contains `#77A7FF` and does not contain the former `#65E6C4` accent.

## Findings

- No actionable P0, P1, or P2 differences remain for the requested web-to-Android palette coherence.
- P3: the internal Tailwind key is still named `mint`; renaming it to `accent` would improve code semantics but would not change the rendered product.

## Final result

final result: passed

## Production-signed release candidate 0.3.0

- Artifact: `.artifacts/android-production/Solana-Android-Hub-v0.3.0.apk`.
- Package: `com.lololabs.solanaandroidhub`, version `0.3.0` / versionCode `3`.
- APK SHA-256: `FE8328FA15E691C5EF293E9AF54B942CF96FB829A27164BFD4E88362E72BA768`.
- Signing certificate SHA-256: `02F204B9CBED11E59F85B2A6DBCB34AD6F0A4658C639D58B2C27FB3BE2AD0E09`.
- The signer DN is `CN=Solana Android Hub, OU=Android Release, O=Lolo Labs, C=FR`; the DegenMerge and Android debug keys are not used.
- APK Signature Scheme v2 and 16 KiB zip alignment verification pass.
- Min SDK 26, target/compile SDK 36, and native ABIs `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`.
- `REQUEST_INSTALL_PACKAGES` is present and `QUERY_ALL_PACKAGES` is absent.
- Installed as a separate application beside `.dev` on a Pixel 9 API 36 emulator; cold launch, production API loading, deep linking, and the DegenMerge detail page pass with no fatal exception.
- Screenshots: `.artifacts/design-qa/mobile-production-home-0.3.0.png` and `.artifacts/design-qa/mobile-production-detail-0.3.0.png`.
- The production-signed APK is published as the public `v0.3.0` GitHub release with the stable filename `Solana-Android-Hub-v0.3.0.apk`.

final result: passed and published as a production-signed public release

## Consumer app-detail pass - release 0.3.0

### Evidence

- App detail: `.artifacts/design-qa/mobile-app-detail-0.3.0.png`.
- Collapsed lower detail: `.artifacts/design-qa/mobile-app-detail-bottom-0.3.0.png`.
- Expanded permissions: `.artifacts/design-qa/mobile-permissions-open-0.3.0.png`.
- Pixel 9 emulator, Android API 36, production catalogue data from `https://solana-hub.lololabs.xyz`.

### Verified experience

- App identity, publisher artwork, screenshots, description, and consumer tags appear before technical information.
- The primary action is the familiar `Install` label; the preview state is disclosed separately as `Preview release`.
- `Data & permissions` and `Verification details` are collapsed by default and remain available on demand.
- Permission labels are consumer-readable. Raw Android permission identifiers are hidden behind a secondary technical disclosure.
- The APK updated in place, launched without a fatal exception, and retained the blue product palette.

### Release checks

- Package `com.lololabs.solanaandroidhub.dev`, version `0.3.0` / versionCode `3`.
- APK SHA-256: `7636FF75F9A690BDB344086747966959B3FBE6593945F2CD1D146E7BE60F686A`.
- Min SDK 26, target/compile SDK 36, ABIs `arm64-v8a` and `x86_64`.
- `REQUEST_INSTALL_PACKAGES` is present and `QUERY_ALL_PACKAGES` is absent.
- APK signature verification and zip alignment pass.

final result: passed
