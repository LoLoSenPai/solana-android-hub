# V1 threat model

## Protected decisions

The Hub must never collapse these facts:

1. current publisher control of the App NFT;
2. authentic Release metadata and APK binary;
3. active, exact, environment-bound distribution consent;
4. independently sourced Solana Mobile approval.

## Principal threats and controls

| Threat | Fail-closed control |
|---|---|
| DAS/indexer spoofing or staleness | Discovery only; finalized raw Token Metadata, mint, edition, and collection verification are authoritative. |
| NFT owner impersonates publisher | Owner/creator arrays are insufficient; current update authority or delegated collection authority is required. |
| Signed-message replay | 256-bit nonce hash, fixed canonical bytes, short expiry, attempt limit, atomic one-time consumption, environment/origin/network binding. |
| Consent confused with sign-in | Distinct message header, purpose, scopes, expiry, terms, policy, and database record. |
| Mutable metadata or APK substitution | Normalized immutable evidence, exact size/SHA, production server validation, and mandatory on-device revalidation. |
| SSRF through metadata/APK URL | HTTPS/port policy, credentials prohibited, DNS resolution, private/reserved address rejection on every redirect, limits and timeouts. |
| Existing incompatible Android edition | Visible signer check where possible; otherwise explicit uncertainty and Android PackageInstaller conflict. Never uninstall. |
| Prepared-file replacement | Opaque native ID, private cache path, size/hash recheck, full APK reinspection immediately before session submission. |
| Preview escapes to production | Production startup validation requires `server_and_device`, final HTTPS origin, non-development terms, and validator configuration. |
| Publisher self-approval | Publisher API can only request approval; allowlisted admin/provider evidence owns approval transitions. |
| Admin tampering | Config allowlist, CSRF/origin controls, evidence reason, and database append-only audit trigger. |
| Credential abuse and brute force | Secure cookies, database-backed rate buckets, bounded challenge attempts, stable errors, no client database credential. |
| Installed-app inventory collection | Only successful Hub installs are stored locally; no enumeration and no inventory upload. |

Approval never overrides publisher authority, consent, server/device authenticity, suspension, revocation, certificate continuity, or no-downgrade behavior.
