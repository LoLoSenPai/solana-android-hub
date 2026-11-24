import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import styles from "./DownloadPage.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get Dapport",
  description: "Download Dapport for Android, verify its APK checksum and follow the installation steps.",
  alternates: { canonical: "/download" }
};

export default function DownloadPage() {
  const apkUrl = optionalUrl(process.env.NEXT_PUBLIC_HUB_ANDROID_APK_URL);
  const apkVersion = process.env.NEXT_PUBLIC_HUB_ANDROID_APK_VERSION?.trim();
  const apkSha256 = process.env.NEXT_PUBLIC_HUB_ANDROID_APK_SHA256?.trim();
  const apkFilename = apkUrl?.pathname.split("/").at(-1);
  const releaseNotesUrl = apkUrl && githubReleaseNotesUrl(apkUrl);
  const showChecksum = apkSha256 && /^[a-f0-9]{64}$/iu.test(apkSha256);

  return (
    <main id="download" className={styles.page}>
      <section className={styles.lead} aria-labelledby="download-title">
        <div className={styles.frame + " " + styles.layout}>
          <div className={styles.intro}>
            <h1 id="download-title">Get Dapport</h1>
            <p className={styles.introCopy}>
              Browse, install and update Solana apps on Android. Dapport verifies each APK on your phone before handing it to Android for installation.
            </p>
            {apkUrl ? (
              <a className={styles.action} href={apkUrl.href} aria-describedby="android-note" rel="noreferrer">
                <DownloadSimple aria-hidden="true" />
                Download Dapport
              </a>
            ) : (
              <p className={styles.unavailable}>The Dapport APK is currently unavailable.</p>
            )}
            <p id="android-note" className={styles.androidNote}>
              When you first install Dapport from an APK, Android may ask you to allow installs from the browser or file manager that opens it.{" "}
              <Link href="/security#android-permission">Why Android asks</Link>
            </p>
          </div>
          <aside className={styles.release} aria-labelledby="release-title">
            <div className={styles.releaseTitle}>
              <Image src="/dapport-mark-512.png" alt="" width={48} height={48} />
              <div>
                <h2 id="release-title">Dapport{apkUrl && apkVersion ? " " + apkVersion : ""}</h2>
                <p>Android 8 or newer</p>
              </div>
            </div>
            {apkUrl && (
              <>
                <dl className={styles.releaseDetails}>
                  {apkFilename && <div><dt>APK file</dt><dd>{apkFilename}</dd></div>}
                  <div className={styles.checksum}>
                    <dt>SHA-256 checksum</dt>
                    <dd>{showChecksum ? <code>{apkSha256}</code> : "Unavailable"}</dd>
                  </div>
                </dl>
                {releaseNotesUrl && (
                  <a className={styles.textLink} href={releaseNotesUrl} rel="noreferrer">
                    Release notes <ArrowUpRight aria-hidden="true" />
                  </a>
                )}
              </>
            )}
          </aside>
        </div>
      </section>

      <section className={styles.frame + " " + styles.install} aria-labelledby="install-title">
        <h2 id="install-title">Install Dapport on Android</h2>
        <ol>
          <li>
            <h3>Open the APK on your phone</h3>
            <p>If you downloaded it on a computer, transfer it to your Android phone and open it in your file manager.</p>
          </li>
          <li>
            <h3>Confirm the installation</h3>
            <p>If prompted, allow installs from the browser or file manager you used. Then confirm the installation in Android.</p>
          </li>
          <li>
            <h3>Open Dapport</h3>
            <p>Choose an app and review its release details. Dapport verifies the APK before Android asks you to confirm.</p>
          </li>
        </ol>
      </section>
    </main>
  );
}

function optionalUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function githubReleaseNotesUrl(apkUrl: URL): string | null {
  const releasePath = /^\/(LoLoSenPai\/solana-android-hub-releases\/releases)\/download\/([^/]+)\/[^/]+$/iu;
  const match = apkUrl.pathname.match(releasePath);
  if (apkUrl.origin !== "https://github.com" || !match) return null;

  const [, repository, tag] = match;
  return new URL(`/${repository}/tag/${tag}`, apkUrl.origin).href;
}
