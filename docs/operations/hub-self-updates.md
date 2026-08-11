# Dapport self-updates

## User flow

- Production Dapport checks for a newer Dapport release at most once every 24 hours.
- A higher version appears as a lightweight banner on Discover.
- Settings always provides a manual **Check for updates** action.
- The update screen shows the installed and available versions, release notes, and
  download size before Android asks for confirmation.
- The first Dapport install still comes from the website. Release `0.3.1` is the bridge
  release that adds in-app updates.
- The Dapport rebrand is `0.4.0` / versionCode `5`; its manifest stays unpublished
  until the production-signed `Dapport-v0.4.0.apk` is public and verified.

## Security boundary

The update path is intentionally the same secure path used for catalogue APKs:

1. Fetch a same-origin, fail-closed release manifest.
2. Require Dapport's permanent package and embedded release-certificate SHA-256.
3. Require a strictly higher version code and a credential-free HTTPS APK URL.
4. Download inside the native module with the configured byte limit.
5. Verify the complete APK SHA-256, package, version, min SDK, permissions, APK
   signatures, and current signer.
6. Recheck the prepared file and hand an opaque prepared ID to Android
   `PackageInstaller`.
7. Let Android enforce user confirmation and installed-package compatibility.

The client never installs a URL directly, never accepts a certificate supplied only
by the server, and never needs `QUERY_ALL_PACKAGES`.

## Publication order

1. Increment both version name and monotonically increasing version code.
2. Build with the permanent Dapport keystore and production configuration.
3. Verify signature, certificate, package, version, SDKs, 16 KiB alignment, ABIs,
   permissions, SHA-256, install/update behavior, and cold launch.
4. Publish the friendly `Dapport-v<version>.apk` asset in `solana-android-hub-releases`.
5. Configure the manifest environment values with the exact verified artifact.
6. Deploy the web app and verify the manifest plus direct APK URL publicly.

If any required manifest value is missing or malformed, the API returns 503 and the
production client presents a retryable error rather than guessing.
