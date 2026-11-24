import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { Minus } from "@phosphor-icons/react/dist/ssr/Minus";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import type { ReactNode } from "react";
import { FaqQuestions } from "./FaqQuestions";
import styles from "./SecurityPage.module.css";

export const metadata: Metadata = {
  title: "FAQ & security",
  description: "Learn how to install Dapport on Android, how apps reach the catalogue, and how Dapport verifies publisher consent and APKs.",
  alternates: { canonical: "/security" }
};

export default function SecurityPage() {
  return (
    <main className={styles.page}>
      <a className={styles.skip} href="#getting-started">Skip to the questions</a>
      <header className={styles.intro}>
        <h1>FAQ <span>&amp; security</span></h1>
        <p>Installing on Android, finding apps and understanding what Dapport checks.</p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.topics} aria-label="FAQ topics">
          <a href="#getting-started">Getting started</a>
          <a href="#apps-publishers">Apps &amp; publishers</a>
          <a href="#checks">Technical details</a>
        </nav>
        <FaqQuestions>
          <section id="getting-started" aria-labelledby="start-heading" tabIndex={-1}>
            <h2 id="start-heading">Getting started</h2>
            <Question id="android-wallet" title="Do I need a Seeker or a wallet?" defaultOpen>
              <p>You can browse on the web and use Dapport on a compatible Android phone. Browsing and installing require no root access, wallet, seed phrase or wallet transaction. An individual app may ask you to connect a wallet for its own features.</p>
              <p>Check “Requires Android” on the app’s listing for its minimum Android version.</p>
            </Question>
            <Question id="android-permission" title="Why does Android ask me to allow this installation?">
              <p>Android asks which apps you trust to start an installation. When you first download Dapport, the request usually names your browser or file manager. Allow the source you used, then return to the APK and confirm the installation. Android asks for your confirmation before every Dapport installation or update.</p>
              <p>When you install your first app through Dapport, Android may ask you to allow Dapport as a source too. You can change this later in Android settings under “Install unknown apps”.</p>
              <Link href="/download">Get Dapport for Android <ArrowRight aria-hidden="true" /></Link>
            </Question>
            <Question id="updates" title="How do updates work?">
              <p>Open your library in Dapport to check for updates to apps you installed through it. Dapport checks the new file and blocks detectable signing conflicts and downgrades. Android applies its package compatibility rules and asks you to confirm the update.</p>
            </Question>
          </section>

          <section id="apps-publishers" aria-labelledby="apps-heading" tabIndex={-1}>
            <h2 id="apps-heading">Apps &amp; publishers</h2>
            <Question id="solana-mobile" title="How is Dapport related to Solana Mobile?">
              <p>Dapport is an independent catalogue that uses the public Solana Mobile publishing format and distributes apps with each publisher’s permission. Solana Mobile operates its own store and makes its own approval decisions.</p>
              <p>The verification details distinguish availability in Solana Mobile’s store from whether the exact APK on Dapport matches an approved release.</p>
            </Question>
            <Question id="release-checks" title="What does Dapport verify before installation?">
              <p>Dapport verifies the current App NFT publishing authority, the relationship between the app and its release, and the publisher’s distribution consent. It checks the APK against finalized Solana release data. Dapport checks the file on your phone again before Android asks you to install it.</p>
              <p>These checks establish where the file came from. They do not audit an app’s code, guarantee its safety, assess an investment or indicate Solana Mobile approval.</p>
              <a href="#apk-checks">See how the APK is checked <ArrowRight aria-hidden="true" /></a>
            </Question>
            <Question id="app-permissions" title="What do the permissions on an app’s listing mean?">
              <p>The list shows permissions declared in that version’s APK. For example, a messaging app can declare microphone access for voice calls. Seeing “Microphone” on its listing does not give the app access on your phone.</p>
              <p>Android can ask you to grant permissions such as camera or microphone access when the app needs them. You can review or change those grants in the app’s Android settings. Other permissions, such as internet access, work without a separate prompt.</p>
              <a href="https://support.google.com/android/answer/9431959?hl=en">Change an app’s permissions in Android <ArrowUpRight aria-hidden="true" /></a>
            </Question>
            <Question id="missing-apps" title="Why are some Solana Mobile apps missing?">
              <p>Each publisher chooses which apps Dapport can distribute. A Dapport listing requires the publisher’s consent and a release that passes the catalogue checks. Publishers can withdraw that consent later.</p>
              <Link href="/publisher">List your app on Dapport <ArrowRight aria-hidden="true" /></Link>
            </Question>
          </section>

          <section id="checks" aria-labelledby="checks-heading" tabIndex={-1}>
            <h2 id="checks-heading">Technical details</h2>
            <Question id="apk-checks" title="How can I verify the APK?">
              <p>Open the verification details on the app’s listing. You can compare the file’s SHA-256 and signing certificate with the values for that version. Dapport validates the APK signature with AOSP <code>apksig</code> and checks the package, version, file size, Android requirements and declared permissions against the release record.</p>
              <p>Dapport requires HTTPS and limits download size and redirects. On your phone, it rechecks the prepared file before starting an Android <code>PackageInstaller</code> session.</p>
              <p>If you transfer an app directly from the publisher, compare its SHA-256 before installing. Dapport’s final checks on your phone only run when you install through Dapport. The Dapport download page provides the checksum for its own APK, and Dapport updates require the same permanent signing certificate.</p>
              <Link href="/download">View the Dapport download <ArrowRight aria-hidden="true" /></Link>
            </Question>
            <Question id="publisher-consent" title="How is a publisher’s permission recorded?">
              <p>Publishers sign a distribution consent message separately from their authentication message. Consent is bound to the app, domain, environment, policy and terms version. Publishers keep their signing keys and can revoke distribution from their workspace.</p>
              <Link href="/publisher/distribution-terms">Publisher distribution terms <ArrowRight aria-hidden="true" /></Link>
            </Question>
            <Question id="privacy" title="What does Dapport know about my installed apps?">
              <p>Dapport keeps a local record of the apps it successfully installs. It uses targeted package checks where Android permits them to detect installation or update conflicts. Your installed-app inventory stays on your device.</p>
              <p>Dapport does not request <code>QUERY_ALL_PACKAGES</code> or uninstall an existing edition. When Dapport cannot inspect another edition, Android makes the final decision about package compatibility.</p>
            </Question>
          </section>

          <p className={styles.report}>
            Something wrong with an app or a download?{" "}
            <a href="https://github.com/LoLoSenPai/solana-android-hub-releases/issues" rel="noreferrer">
              Report an issue <ArrowUpRight aria-hidden="true" />
            </a>
          </p>
        </FaqQuestions>
      </div>
    </main>
  );
}

function Question({ id, title, defaultOpen, children }: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <span className={styles.questionIcon} aria-hidden="true">
          <Plus className={styles.plus} />
          <Minus className={styles.minus} />
        </span>
      </summary>
      <div className={styles.answer}>{children}</div>
    </details>
  );
}
