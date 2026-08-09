import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get Android Hub",
  description: "Download Solana Android Hub and understand the checks it performs before Android installation."
};

export default function DownloadPage() {
  const apkUrl = optionalUrl(process.env.NEXT_PUBLIC_HUB_ANDROID_APK_URL);
  const apkSha256 = process.env.NEXT_PUBLIC_HUB_ANDROID_APK_SHA256?.trim();
  const apkVersion = process.env.NEXT_PUBLIC_HUB_ANDROID_APK_VERSION?.trim() || "0.1.0 early access";

  return (
    <main className="download-page">
      <section className="download-hero">
        <div className="download-hero-copy">
          <p className="eyebrow">Android app</p>
          <h1>Take the catalogue with you.</h1>
          <p>Android Hub is the recommended way to install releases from this catalogue. It downloads the APK, verifies its published identity on your device, then hands it to Android's system installer.</p>
          <div className="hero-actions">
            {apkUrl ? (
              <a className="primary-action" href={apkUrl} rel="noreferrer">Download Android Hub</a>
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
        <div className="download-device-card" aria-hidden="true">
          <Image src="/hub-mark.png" alt="" width={180} height={180} priority />
          <div><span>01</span><strong>Choose an app</strong></div>
          <div><span>02</span><strong>Verify on device</strong></div>
          <div><span>03</span><strong>Open Android installer</strong></div>
        </div>
      </section>

      <section className="download-explainer" aria-labelledby="why-hub-heading">
        <div>
          <p className="eyebrow">Why a native Hub?</p>
          <h2 id="why-hub-heading">The website cannot see what Android knows.</h2>
        </div>
        <div className="download-explainer-copy">
          <p>A browser can show catalogue metadata, but it cannot safely inspect the package already installed on your phone or submit a verified file to PackageInstaller. The Hub performs those last checks locally without uploading your installed-app inventory.</p>
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
          <p>You only need to allow installs from the browser or file manager you use for this first Hub APK.</p>
        </div>
        <ol>
          <li><span>1</span><strong>Download Android Hub</strong><p>Open this page on your Android phone, or transfer the downloaded APK from your computer.</p></li>
          <li><span>2</span><strong>Approve this source</strong><p>Android may open “Install unknown apps”. Allow only the browser or file manager you are using.</p></li>
          <li><span>3</span><strong>Open the Hub</strong><p>Browse a release, review its trust facts, and let the Hub verify it before Android installs it.</p></li>
        </ol>
      </section>

      <aside className="download-direct-note">
        <div><p className="eyebrow">Prefer a manual APK?</p><h2>Direct downloads remain available.</h2></div>
        <p>Each app page also links to the publisher-hosted APK for desktop transfer. That is convenient, but it bypasses the Hub's final on-device verification. Always compare the SHA-256 shown on the app page.</p>
      </aside>

      {apkSha256 ? <p className="hub-apk-hash"><span>Android Hub APK SHA-256</span><code>{apkSha256}</code></p> : null}
    </main>
  );
}

function optionalUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
