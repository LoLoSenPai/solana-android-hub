import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Publisher distribution terms",
  description: "The authorization publishers grant when listing an Android release on Dapport."
};

export default function DistributionTermsPage() {
  return (
    <main className="legal-page">
      <section className="hero compact">
        <p className="eyebrow">Publisher distribution authorization</p>
        <h1>Dapport distribution terms</h1>
        <p>Version DAPPORT-DISTRIBUTION-2026-08-11 · effective 11 August 2026</p>
      </section>

      <article className="panel legal-copy">
        <h2>What you authorize</h2>
        <p>By signing Dapport&apos;s distribution consent message for an App NFT, you authorize Dapport to list that app, use its public publisher-provided metadata and artwork, facilitate installation of its published Android APK, and monitor future Release NFTs for updates.</p>

        <h2>What you keep</h2>
        <p>You keep ownership of your app, intellectual property, signing keys, NFTs, accounts, funds, and hosting. This is a non-exclusive, worldwide, revocable permission limited to operating the Dapport catalogue and Android installation flow.</p>

        <h2>Your confirmations</h2>
        <p>You confirm that you control the App NFT authority used for the claim, may distribute the APK and supplied content, and that the release metadata accurately identifies the package, version, hash, signing certificate, permissions, and download location.</p>

        <h2>Validation and publication</h2>
        <p>Dapport may temporarily download an APK to an ephemeral validator and to a user&apos;s Android device. Publication is conditional on metadata and binary checks. Dapport may reject, quarantine, suspend, or withdraw a release that fails those checks, conflicts with policy, or presents a security, legal, or operational risk.</p>

        <h2>Automatic or manual releases</h2>
        <p>If you choose automatic publication, eligible future releases may be listed after all active production gates pass. If you choose manual publication, each validated release waits for your publication action.</p>

        <h2>Revocation</h2>
        <p>You may revoke Dapport distribution from the publisher workspace. Revocation stops new catalogue distribution; it cannot remove copies users already installed or control files held by third-party hosting providers.</p>

        <h2>Independent service</h2>
        <p>Dapport is independent and is not affiliated with or endorsed by Solana Mobile. Solana Mobile approval, when displayed, is a separate fact and is never implied by publisher consent.</p>

        <p className="legal-return"><Link href="/publisher">Return to the publisher workspace</Link></p>
      </article>
    </main>
  );
}
