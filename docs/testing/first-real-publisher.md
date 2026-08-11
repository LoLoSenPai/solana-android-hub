# First real publisher staging test

This runbook verifies the first real Publisher → App → Release flow without creating production consent or claiming production verification.

## Publish through the official portal

1. Create the publisher account at <https://publish.solanamobile.com> and complete the portal's required publisher verification.
2. Connect the wallet that will remain the publisher authority. Keep access to this wallet; never share its seed phrase or private key with the Hub.
3. Prepare the release-signed APK, icon, screenshots, descriptions, privacy disclosures, and other listing metadata.
4. Create the dApp in the portal, then submit its first version. Approve every portal signing request so the App and Release relationships and hosted metadata are complete.

The Hub does not accept a generic NFT. It discovers through Helius DAS, then independently verifies finalized raw Token Metadata accounts. The connected wallet must be the current App metadata update authority or an authorized collection delegate; NFT ownership alone is insufficient.

## Verify in Dapport staging

1. Open <https://dapport.app/publisher> in a browser with a Wallet Standard wallet that supports Ed25519 message signing.
2. Connect the same publisher-authority wallet and sign the authentication challenge. This is sign-in only, not distribution consent.
3. Select **Discover authorized Apps**. If the App NFT was just minted, allow a short indexing delay and retry.
4. Claim the discovered App. The backend rechecks that the App is a collection NFT and verifies finalized wallet authority. A legacy Publisher collection parent is checked when present, but current portal App NFTs do not require one.
5. Review and sign the separate **staging** distribution-consent message. This consent is non-promotable and never qualifies as production consent.
6. Select **Sync Releases**. The Release must be immutable, unburned, uncompressed, and have a verified collection relationship to the App NFT. Its metadata must match the pinned publishing schema and APK identity fields.
7. Confirm the catalogue labels the result **Development preview**. It must not display a production verified-release label or Solana Mobile approval unless those independent gates are satisfied.

## If the App is not discovered

- Confirm the same wallet is still the App metadata update authority or a valid collection delegate.
- Confirm the App NFT was created by the current Solana Mobile Publisher Portal and is itself a collection NFT rather than a generic NFT.
- Confirm all portal signing steps completed. The Release NFT must have a verified collection relationship to the App NFT; the current App NFT may have no parent collection.
- Retry after the DAS indexing delay. If it still fails, record only the public App mint and wallet address for diagnosis; never provide private keys, seed phrases, or the portal API key.

Official references: [Submit a New App](https://docs.solanamobile.com/dapp-store/submit-new-app) and [dApp Publishing CLI](https://docs.solanamobile.com/dapp-store/publishing-cli).
