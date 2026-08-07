# Hub test APKs

This project creates the non-production APK matrix used to prove the native installer. The checked-in signing stores use public fixture-only passwords and must never sign the Hub or a production publisher app.

- `v1.apk`: `com.lololabs.hubfixture`, version code 1.
- `v2.apk`: same package and signer, version code 2.
- `wrong-package.apk`: a different package signed by the fixture signer.
- `wrong-certificate.apk`: the expected package signed by the intentionally different fixture signer.

The generated `artifacts/manifest.json` is authoritative for fixture byte sizes, SHA-256 hashes, package versions, permissions, and certificate fingerprints.
