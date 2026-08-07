# Android vertical slice — API 36 evidence

## Result

Passed on 2026-08-07 using the Pixel 9 API 36 emulator (`emulator-5554`) and the real Android system installer. No native or backend step in the install/update path was mocked.

The verified sequence was:

1. Local Supabase served the consented, allowlisted App and v1 Release as `development_preview`.
2. The standalone Hub APK rendered the Release from the real catalogue API.
3. Android's app-specific unknown-sources screen granted install capability to the Hub.
4. Kotlin downloaded `v1.apk` over HTTPS and verified its byte length, SHA-256, AOSP APK signature, package, version, minSdk, permission set, and current signer.
5. `PackageInstaller.Session` opened Android's confirmation UI. Play Protect scanned the test APK and Android installed it.
6. `dumpsys package com.lololabs.hubfixture` reported version code 1 and version name 1.0.0.
7. The seed transition exposed v2. The Hub's local SQLite record plus targeted package inspection reported `Update available: v2.0.0 (2)`.
8. The Kotlin preflight accepted the same signer and higher version. Android displayed `Do you want to update this app?`.
9. Android completed the update. `dumpsys` reported version code 2, version name 2.0.0, and an unchanged first-install timestamp.

Final installed state:

```text
package=com.lololabs.hubfixture
versionCode=2
versionName=2.0.0
minSdk=26
targetSdk=36
firstInstallTime=2026-08-07 21:37:24
lastUpdateTime=2026-08-07 21:46:03
```

![Hub confirms the validated v2 installation](../assets/vertical-slice/hub-installed-v2.png)

## Fixed fixture identities

| Artifact | SHA-256 | Package/version | Certificate SHA-256 |
|---|---|---|---|
| v1 | `8e50cee640062ba1bfcfb7c3bcae7afbf33dd803e4c26219a132387b8ebf5160` | `com.lololabs.hubfixture` / 1 | `ad3ab6f4878a16a91ccc0572d3a96248cf2c50ad195187209dcc9a7814c716ef` |
| v2 | `5c88eeb5b4eace009f859058c4c5fadfeb3f1695c78a135e48f3a53d2afb4653` | `com.lololabs.hubfixture` / 2 | `ad3ab6f4878a16a91ccc0572d3a96248cf2c50ad195187209dcc9a7814c716ef` |
| wrong package | `374c8ad17eec96dae743cf4d0badd2e7edc8f1d0f6bc4e64e20688d76f5758b4` | different package | fixture certificate |
| wrong certificate | `4c0ba5fdea5888e180b968435be608b26bfa6879f3e17b9cd6f9abed8ebcccab` | expected package | `1ba54468327f92d1e3f90d419e4f4c333a2fe07d754237932e4552615d37f4be` |

The checked-in manifest in `fixtures/apks/hub-test-app/artifacts/manifest.json` remains the machine-readable source.

## Security assertions

- The merged debug APK requested `REQUEST_INSTALL_PACKAGES` and did not request `QUERY_ALL_PACKAGES`.
- The only exact package query is the fixed internal fixture `com.lololabs.hubfixture`.
- JavaScript never provides a file path to PackageInstaller; it can submit only a native opaque prepared ID.
- The prepared file is rehashed and re-inspected immediately before session submission.
- Native unit tests block package, version, minSdk, permission, certificate, installed-edition, and downgrade mismatches.
- A user cancellation or PackageInstaller conflict never triggers an uninstall.
- Only the Hub's own successful installation records are kept in SQLite; no installed-app inventory is uploaded.

Mobile MCP was unavailable in the active connector set, so the equivalent real-device control path used explicit ADB targeting. The physically connected Seeker was not modified.
