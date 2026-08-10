# Android release signing

The standalone Hub uses a dedicated Android signing identity. Never reuse a publisher app key for the Hub.

## Permanent identity

- Package: `com.lololabs.solanaandroidhub`
- Key alias: `solana-android-hub`
- Certificate SHA-256: `02F204B9CBED11E59F85B2A6DBCB34AD6F0A4658C639D58B2C27FB3BE2AD0E09`
- Local keystore: `C:\Users\loicd\Documents\SigningKeys\solana-android-hub-release.keystore`
- Public certificate: `C:\Users\loicd\Documents\SigningKeys\solana-android-hub-release-certificate.pem`
- Windows DPAPI credential: `%APPDATA%\SolanaAndroidHub\release-signing-password.clixml`

The keystore and its password must be backed up separately. Losing this key prevents existing standalone installations from accepting future Hub updates.

## Required build environment

Production builds require all of the following values and fail before compilation when one is missing:

- `HUB_RELEASE_STORE_FILE`
- `HUB_RELEASE_STORE_PASSWORD`
- `HUB_RELEASE_KEY_ALIAS`
- `HUB_RELEASE_KEY_PASSWORD`

The build also requires:

- `NODE_ENV=production`
- `APP_ENV=production`
- `EXPO_PUBLIC_HUB_ORIGIN=https://solana-hub.lololabs.xyz`
- `RELEASE_PUBLICATION_GATE=server_and_device`

Signing secrets must only be supplied through the process environment. They must never be written into Gradle files, committed, logged, or embedded in build artifacts.

## Distribution artifact

Use the stable public filename `Solana-Android-Hub-v<version>.apk`. Before publishing it, verify the package, version, certificate, APK signature schemes, zip alignment, supported ABIs, permissions, SHA-256, installation, cold launch, and catalogue configuration.

Release `0.3.0` is published as a public GitHub prerelease in the dedicated
[`solana-android-hub-releases`](https://github.com/LoLoSenPai/solana-android-hub-releases/releases/tag/v0.3.0)
repository. The release asset is intentionally labelled early access while
`/api/v1/config` reports `staging` or permits preview releases; publishing the
signed client does not promote staging catalogue consent or validation evidence
into production.
