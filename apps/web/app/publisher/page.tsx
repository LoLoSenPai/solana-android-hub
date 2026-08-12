import Link from "next/link";
import { hubConfig } from "@/server/runtime";
import { isPublisherOnboardingEnabled } from "@/server/publisher-availability";
import { PublisherClient } from "./PublisherClient";

export default function PublisherPage() {
  const onboardingEnabled = isPublisherOnboardingEnabled(hubConfig.heliusApiKey);

  return (
    <main>
      <section className="hero compact">
        <p className="eyebrow">Publisher workspace</p>
        <h1>{onboardingEnabled ? "Bring your Solana app to every Android." : "Publisher onboarding is not open yet."}</h1>
        <p>{onboardingEnabled
          ? "Connect the wallet used for your App NFT. Dapport guides you from discovery to publication and keeps every listing under your control."
          : "The public staging catalogue is available, but finalized Solana chain verification is not configured for publisher onboarding in this environment."}</p>
        <Link className="publisher-security-link" href="/security">How Dapport verifies releases <span aria-hidden="true">→</span></Link>
      </section>
      {onboardingEnabled ? <PublisherClient termsVersion={hubConfig.consentTermsVersion} /> : <PublisherUnavailable />}
    </main>
  );
}

function PublisherUnavailable() {
  return (
    <section className="publisher-workspace" aria-labelledby="publisher-unavailable-title">
      <div className="panel publisher-unavailable">
        <p className="step-label">Onboarding paused</p>
        <h2 id="publisher-unavailable-title">No wallet connection or consent signing is available here.</h2>
        <p>Until finalized-chain verification is configured, this site will not ask publishers to connect a wallet, sign in, claim an App NFT, or create distribution consent.</p>
        <p className="muted">Catalogue previews remain isolated to staging and cannot become production consent or production releases.</p>
        <Link className="publisher-catalogue-link" href="/#discover">Explore the catalogue</Link>
      </div>
    </section>
  );
}
