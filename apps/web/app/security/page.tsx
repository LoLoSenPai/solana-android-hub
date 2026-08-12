import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { DeviceMobile } from "@phosphor-icons/react/dist/ssr/DeviceMobile";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr/ShieldCheck";

export const metadata: Metadata = {
  title: "Security & transparency",
  description: "What Dapport checks, what Android controls, what data stays private, and the limits of APK verification.",
  alternates: { canonical: "/security" }
};

export default function SecurityPage() {
  return (
    <main className="security-page">
      <section className="security-hero">
        <div>
          <p className="eyebrow">Security & transparency</p>
          <h1>Trust should be explained, not implied.</h1>
          <p className="security-lede">Dapport is a publisher-authorized Android catalogue built on the public Solana Mobile publishing format. It is not a ROM, an Android modification, or an official Solana Mobile store.</p>
          <div className="hero-actions">
            <Link className="primary-action" href="/download">Get Dapport</Link>
            <a className="secondary-action" href="#checks">See the checks</a>
          </div>
        </div>
        <aside className="security-plain-card" aria-label="Dapport in plain language">
          <ShieldCheck aria-hidden="true" weight="duotone" />
          <p className="eyebrow">In plain language</p>
          <strong>You choose. Dapport checks. Android confirms.</strong>
          <p>No root access, no silent installation, no seed phrase, and no wallet transaction are required to browse or install apps.</p>
        </aside>
      </section>

      <section className="security-boundary" id="checks" aria-labelledby="security-checks-heading">
        <div className="section-title-row">
          <div><p className="eyebrow">Three visible boundaries</p><h2 id="security-checks-heading">Who checks what?</h2></div>
          <p>Each layer has one job. No single badge silently replaces the other evidence.</p>
        </div>
        <ol>
          <li><span aria-hidden="true">01</span><strong>Solana publishing evidence</strong><p>Dapport verifies the current App NFT publishing authority, the Release relationship, and the publisher&apos;s separate distribution consent.</p></li>
          <li><span aria-hidden="true">02</span><strong>Dapport server and phone</strong><p>The downloaded APK must match its published size, SHA-256, package, version, SDK, permissions, signature, and signing certificate.</p></li>
          <li><span aria-hidden="true">03</span><strong>Android</strong><p>Android&apos;s supported PackageInstaller shows the final system confirmation and enforces installed-package compatibility.</p></li>
        </ol>
      </section>

      <section className="security-scope" aria-labelledby="security-scope-heading">
        <div>
          <p className="eyebrow">Honest limits</p>
          <h2 id="security-scope-heading">Identity is not a security audit.</h2>
          <p>Dapport can prove that the file matches the release identity authorized by its publisher. It cannot promise that an app is bug-free, risk-free, financially sound, or independently audited.</p>
        </div>
        <dl>
          <div><dt>What “checked release” means</dt><dd>The APK identity matches the release data Dapport synchronized from finalized Solana publishing metadata.</dd></div>
          <div><dt>What it does not mean</dt><dd>It is not a blanket “safe” badge, a code audit, an endorsement, or proof of Solana Mobile approval.</dd></div>
          <div><dt>Solana Mobile approval</dt><dd>When available, it is displayed as a separate fact. A publisher cannot assign it to their own app.</dd></div>
        </dl>
      </section>

      <section className="security-privacy" aria-labelledby="security-privacy-heading">
        <div className="security-privacy-heading">
          <DeviceMobile aria-hidden="true" weight="duotone" />
          <div><p className="eyebrow">On your phone</p><h2 id="security-privacy-heading">Least privilege by design.</h2></div>
        </div>
        <div className="security-fact-grid">
          <article><strong>No root or modified Android</strong><p>Dapport uses normal Android application APIs and the supported system installer.</p></article>
          <article><strong>No silent installs</strong><p>Dapport explicitly requires Android&apos;s user confirmation before an installation or update proceeds.</p></article>
          <article><strong>No app-inventory upload</strong><p>Only successful Dapport installations are recorded locally. Your installed-app inventory never leaves the device.</p></article>
          <article><strong>No broad package visibility</strong><p>Dapport does not request <code>QUERY_ALL_PACKAGES</code> and never enumerates unrelated applications.</p></article>
          <article><strong>No consumer wallet required</strong><p>Browsing and installing do not require a wallet, seed phrase, transaction, or access to your funds.</p></article>
          <article><strong>Updates keep one identity</strong><p>Dapport updates must use its permanent Android signing certificate, and Android rejects incompatible signatures.</p></article>
        </div>
      </section>

      <section className="security-details" aria-labelledby="security-details-heading">
        <div><p className="eyebrow">Technical detail, when you want it</p><h2 id="security-details-heading">Inspect the boundaries.</h2></div>
        <div className="security-disclosures">
          <details><summary>APK download and validation</summary><p>Dapport enforces HTTPS, redirect and size limits, verifies the complete SHA-256, validates the APK with AOSP <code>apksig</code>, inspects its manifest and current signer, then rechecks the prepared file immediately before creating the PackageInstaller session.</p></details>
          <details><summary>Publisher authorization</summary><p>The publisher signs an authentication message and a different distribution-consent message. Consent is bound to the app, domain, environment, policy and terms version, and can be revoked without transferring an NFT or signing key.</p></details>
          <details><summary>Package visibility and conflicts</summary><p>Dapport tracks only its own successful installs and performs targeted package checks where Android permits them. If another edition cannot be inspected, uncertainty stays visible and Android remains the final conflict authority. Dapport never uninstalls an existing edition.</p></details>
          <details><summary>Dapport itself</summary><p>The first Dapport APK is downloaded from the public release repository and its SHA-256 is published on the download page. Later updates require the same embedded signing identity and pass through the same native validation path.</p></details>
        </div>
      </section>

      <aside className="security-report">
        <div><p className="eyebrow">Found something wrong?</p><h2>Stop before installing.</h2><p>If an app, release, checksum, permission or Dapport behavior looks suspicious, do not continue. Report only public technical details and never share a seed phrase or private key.</p></div>
        <a className="secondary-action" href="https://github.com/LoLoSenPai/solana-android-hub-releases/issues" rel="noreferrer">Report an issue <ArrowRight aria-hidden="true" /></a>
      </aside>
    </main>
  );
}
