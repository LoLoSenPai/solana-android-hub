import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get Dapport",
  description: "Download Dapport for Android and understand the checks it performs before installation."
};

export default function DownloadPage() {
  const apkUrl = optionalUrl(process.env.NEXT_PUBLIC_HUB_ANDROID_APK_URL);
  const apkSha256 = process.env.NEXT_PUBLIC_HUB_ANDROID_APK_SHA256?.trim();
  const apkVersion = process.env.NEXT_PUBLIC_HUB_ANDROID_APK_VERSION?.trim() || "Not configured";

  return (
    <main className="download-page">
      <section className="download-hero">
        <div className="download-hero-copy">
          <p className="eyebrow">Android app</p>
          <h1>Take the catalogue with you.</h1>
          <p>Dapport is the recommended way to install releases from this catalogue. It downloads the APK, verifies its published identity on your device, then hands it to Android's system installer.</p>
          <div className="hero-actions">
            {apkUrl ? (
              <a className="primary-action" href={apkUrl} rel="noreferrer">Download Dapport</a>
            ) : (
              <span className="primary-action is-disabled" aria-disabled="true">Early-access APK coming soon</span>
            )}
            <Link className="secondary-action" href="/#discover">Browse apps first</Link>
          </div>
          <p className="download-status">
            <strong>{apkVersion}</strong>
            {apkUrl ? " · Android 8 or newer" : " · The public file will appear here after its permanent Android signing identity is fixed."}
          </p>
        </div>
        <div className="download-device-card">
          <div className="download-device-heading">
            <Image src="/dapport-mark-512.png" alt="Dapport" width={180} height={180} priority />
            <div><span>Install on Android</span><strong>From discovery to confirmation</strong></div>
          </div>
          <ol className="download-device-flow" aria-label="Dapport installation flow">
            {INSTALL_STEPS.map((step) => (
              <li key={step.number}>
                <Image src={step.icon} alt="" width={512} height={512} sizes="64px" loading="eager" aria-hidden="true" />
                <span className="device-step-number" aria-hidden="true">{step.number}</span>
                <span className="device-step-copy"><strong>{step.deviceTitle}</strong><small>{step.deviceCopy}</small></span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="download-explainer" aria-labelledby="why-dapport-heading">
        <div>
          <p className="eyebrow">Why the Android app?</p>
          <h2 id="why-dapport-heading">The website cannot see what Android knows.</h2>
        </div>
        <div className="download-explainer-copy">
          <p>A browser can show catalogue metadata, but it cannot safely inspect the package already installed on your phone or submit a verified file to PackageInstaller. Dapport performs those last checks locally without uploading your installed-app inventory.</p>
          <ul>
            <li><strong>Binary identity</strong><span>SHA-256, package, version, SDK, permissions, and signing certificate must match.</span></li>
            <li><strong>Update safety</strong><span>Visible signer conflicts and determinable downgrades are blocked before installation.</span></li>
            <li><strong>Android confirmation</strong><span>The final installation still uses Android's supported system confirmation flow.</span></li>
          </ul>
        </div>
      </section>

      <section className="download-steps" aria-labelledby="install-steps-heading">
        <div className="section-title-row">
          <div><p className="eyebrow">First installation</p><h2 id="install-steps-heading">Three short steps.</h2></div>
          <p>You only need to allow installs from the browser or file manager you use for this first Dapport APK.</p>
        </div>
        <ol>
          {INSTALL_STEPS.map((step, index) => (
            <li key={step.number}>
              <span className="download-step-number" aria-hidden="true">{step.number}</span>
              <span className="download-step-art" aria-hidden="true"><Image src={step.icon} alt="" width={512} height={512} sizes="180px" loading="eager" /></span>
              <div className="download-step-copy"><strong>{step.title}</strong><p>{step.copy}</p></div>
              {index < INSTALL_STEPS.length - 1 ? <ArrowRight className="download-step-arrow" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      </section>

      <aside className="download-direct-note">
        <div><p className="eyebrow">Prefer a manual APK?</p><h2>Direct downloads remain available.</h2></div>
        <p>Each app page also links to the publisher-hosted APK for desktop transfer. That is convenient, but it bypasses Dapport's final on-device verification. Always compare the SHA-256 shown on the app page.</p>
      </aside>

      {apkSha256 ? <p className="hub-apk-hash"><span>Dapport APK SHA-256</span><code>{apkSha256}</code></p> : null}
    </main>
  );
}

const INSTALL_STEPS = [
  {
    number: "01",
    icon: "/download-icons/download-hub.webp",
    title: "Download Dapport",
    copy: "Open this page on your Android phone, or transfer the downloaded APK from your computer.",
    deviceTitle: "Choose a release",
    deviceCopy: "Start from the catalogue."
  },
  {
    number: "02",
    icon: "/download-icons/approve-source.webp",
    title: "Approve this source",
    copy: "Android may open “Install unknown apps”. Allow only the browser or file manager you are using.",
    deviceTitle: "Verify on device",
    deviceCopy: "Dapport checks the APK locally."
  },
  {
    number: "03",
    icon: "/download-icons/open-hub.webp",
    title: "Open Dapport",
    copy: "Browse a release, review its trust facts, and let Dapport verify it before Android installs it.",
    deviceTitle: "Confirm with Android",
    deviceCopy: "The system installer stays in control."
  }
] as const;

function optionalUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
