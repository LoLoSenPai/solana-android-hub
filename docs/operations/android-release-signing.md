# Dapport Android release signing

Dapport uses a dedicated Android signing identity. Never reuse a publisher app key for Dapport.

## Permanent identity

- Package: `com.lololabs.solanaandroidhub`
- Key alias: `solana-android-hub`
- Certificate SHA-256: `02F204B9CBED11E59F85B2A6DBCB34AD6F0A4658C639D58B2C27FB3BE2AD0E09`
- Local keystore: `C:\Users\loicd\Documents\SigningKeys\solana-android-hub-release.keystore`
- Public certificate: `C:\Users\loicd\Documents\SigningKeys\solana-android-hub-release-certificate.pem`
- Windows DPAPI credential: `%APPDATA%\SolanaAndroidHub\release-signing-password.clixml`

The package, alias, keystore filenames and credential location intentionally keep
their original technical identifiers. Changing any of them is unnecessary, and
changing the package or signing key would break updates for existing installs.

The keystore and its password must be backed up separately. Losing this key prevents existing standalone installations from accepting future Dapport updates.

## Required build environment

Production builds require all of the following values and fail before compilation when one is missing:

- `HUB_RELEASE_STORE_FILE`
- `HUB_RELEASE_STORE_PASSWORD`
- `HUB_RELEASE_KEY_ALIAS`
- `HUB_RELEASE_KEY_PASSWORD`

The build also requires:

- `NODE_ENV=production`
- `APP_ENV=production`
- `EXPO_PUBLIC_HUB_ORIGIN=https://dapport.app`
- `RELEASE_PUBLICATION_GATE=server_and_device`

Signing secrets must only be supplied through the process environment. They must never be written into Gradle files, committed, logged, or embedded in build artifacts.

## Reproducible Windows build

Run the checked-in production builder from the repository root:

```powershell
& .\tooling\android\build-production.ps1
```

The script consistently uses the persistent short build cache `C:\hubb03`, which is
the same workspace used for earlier signed releases. It incrementally synchronizes
only mobile source and workspace packages while preserving its short-path pnpm and
Gradle caches. This avoids both long-path failures and repeated full copies. It loads
the password from the Windows DPAPI credential and writes the verified result to
`.artifacts\android-production\Dapport-v<version>.apk`, and fails if the package,
version, signing certificate, APK signature, or 16 KiB zip alignment is wrong.

## Distribution artifact

Use the stable public filename `Dapport-v<version>.apk`. Before publishing it, verify the package, version, certificate, APK signature schemes, zip alignment, supported ABIs, permissions, SHA-256, installation, cold launch, and catalogue configuration.

Release `0.3.1` is published as a production-signed public release in the dedicated
[`solana-android-hub-releases`](https://github.com/LoLoSenPai/solana-android-hub-releases/releases/tag/v0.3.1)
repository. Its historical asset name is `Solana-Android-Hub-v0.3.1.apk`; the first
Dapport-branded release is `0.4.0` and every release from that point uses
`Dapport-v<version>.apk`.

## Self-update release contract

Starting with `0.3.1`, Dapport checks the same-origin
`/api/v1/hub/releases/latest` manifest at most once every 24 hours and also exposes
a manual check in Settings. A release must never be announced there until the
production-signed APK is public and all of the checks above have passed.

The manifest pins the permanent package and signing certificate as well as the
version code, byte size, SHA-256, minimum SDK, permissions, release notes, and APK
URL. The mobile client rejects a different package, signing identity, insecure or
credential-bearing URL, malformed digest, or non-increasing version code. It then
reuses the native APK verifier and Android `PackageInstaller`; the manifest is not
an authorization to skip device validation.

`0.3.0` and earlier do not contain the updater, so moving from `0.3.0` to `0.3.1`
is the last manual download under the previous name. Future releases can be
discovered and installed inside Dapport.
