import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogApp } from "../../../server/catalog-service";

export const dynamic = "force-dynamic";

export default async function AppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await getCatalogApp(slug, "trusted");
  if (!app) notFound();

  const authenticity = app.latestRelease.previewOnly ? "Development preview" : "Server-validated release";
  const approval = approvalLabel(app.latestRelease.trust.solanaMobileApproval);
  const heroArtwork = app.bannerUrl ?? app.featureGraphicUrl ?? app.screenshots[0];

  return (
    <main className="app-detail-page">
      <article>
        <div className="detail-back-row">
          <Link className="text-link" href="/">Back to catalogue</Link>
          <span>{app.latestRelease.packageName}</span>
        </div>

        <section className="detail-hero" aria-labelledby="app-title">
          {heroArtwork
            // Publisher screenshot hosts are metadata-driven, so they stay direct instead of enabling a broad Next image proxy allowlist.
            ? <img className="detail-hero-image" src={heroArtwork} alt={`${app.name} cover artwork`} />
            : <Image className="detail-hero-image" src="/hub-hero.png" alt="" fill priority sizes="(max-width: 760px) 100vw, 1280px" />}
          <span className="detail-hero-scrim" aria-hidden="true" />
          <span className="detail-state">{authenticity}</span>
        </section>

        <section className="detail-intro">
          {app.iconUrl
            // Publisher icon hosts are metadata-driven, so they stay direct instead of enabling a broad Next image proxy allowlist.
            ? <img className="detail-app-icon" src={app.iconUrl} alt={`${app.name} icon`} />
            : <Image className="detail-app-icon" src="/hub-app-fallback.png" width={160} height={160} alt={`${app.name} icon`} />}
          <div className="detail-title-copy">
            <p className="eyebrow">{categoryFromApp(app.category)}</p>
            <h1 id="app-title">{app.name}</h1>
            <p>{app.shortDescription ?? "An independently published Android app for the Solana ecosystem."}</p>
          </div>
          <div className="detail-primary-action">
            <a className="primary-action" href="#release">Review Android release</a>
            <small>Installation continues in the Android Hub after full on-device validation.</small>
          </div>
        </section>

        <section className={`detail-description editorial-split${app.featureGraphicUrl ? " has-feature-art" : ""}`} aria-labelledby="about-heading">
          <div>
            <p className="eyebrow">About this app</p>
            <h2 id="about-heading">A clear view before you install.</h2>
          </div>
          <div className="detail-about-copy">
            <p>{app.description ?? app.shortDescription ?? "The publisher has not provided a longer description for this release yet."}</p>
            {app.featureGraphicUrl ? <img src={app.featureGraphicUrl} alt={`${app.name} feature artwork`} /> : null}
          </div>
        </section>

        {app.screenshots.length > 0 ? (
          <section className="screenshot-section" aria-labelledby="screenshots-heading">
            <div className="section-title-row"><h2 id="screenshots-heading">Preview</h2><span>{app.screenshots.length} images</span></div>
            <div className="screenshot-rail">
              {/* Publisher screenshot hosts are validated metadata, but remain direct to avoid a broad image-proxy allowlist. */}
              {app.screenshots.map((screenshot, index) => (
                <img key={screenshot} src={screenshot} alt={`${app.name} screenshot ${index + 1}`} />
              ))}
            </div>
          </section>
        ) : (
          <section className="detail-editorial-card" aria-label="Android Hub installation promise">
            <Image src="/hub-hero.png" alt="" fill sizes="(max-width: 760px) 100vw, 1280px" />
            <div><p className="eyebrow">A safer hand-off</p><h2>The APK is checked before Android ever sees it.</h2><p>Hash, package, version, minimum SDK, permissions, and signing certificate must all match the published release.</p></div>
          </section>
        )}

        <section className="detail-trust" aria-labelledby="trust-facts-heading">
          <div className="section-title-row">
            <div><p className="eyebrow">Visible evidence</p><h2 id="trust-facts-heading">Trust facts</h2></div>
            <p>These checks answer different questions and never collapse into a generic verified claim.</p>
          </div>
          <dl className="detail-trust-grid">
            <div><span>01</span><dt>Publisher control</dt><dd>Verified from current finalized authority evidence.</dd><strong>Verified</strong></div>
            <div><span>02</span><dt>Distribution consent</dt><dd>A separate, environment-bound consent is active.</dd><strong>Active</strong></div>
            <div><span>03</span><dt>Release authenticity</dt><dd>The APK must match its published identity and certificate.</dd><strong>{authenticity}</strong></div>
            <div><span>04</span><dt>Independent approval</dt><dd>Approval cannot be asserted by the publisher.</dd><strong>{approval}</strong></div>
          </dl>
        </section>

        <section className="release-section" id="release" aria-labelledby="release-heading">
          <div className="release-copy">
            <p className="eyebrow">Current Android release</p>
            <h2 id="release-heading">Version {app.latestRelease.versionName}</h2>
            <p>Version code {app.latestRelease.versionCode} · requires Android {androidVersion(app.latestRelease.minSdk)} or newer · {formatFileSize(app.latestRelease.apkSize)}</p>
            <p className="muted">The Android Hub validates the full SHA-256, package name, version, and signing certificate again on-device before opening PackageInstaller.</p>
          </div>
          <dl className="release-facts">
            <div><dt>Package</dt><dd>{app.latestRelease.packageName}</dd></div>
            <div><dt>Target SDK</dt><dd>{app.latestRelease.targetSdk ? `API ${app.latestRelease.targetSdk}` : "Not declared"}</dd></div>
            <div><dt>APK SHA-256</dt><dd>{shortHash(app.latestRelease.apkSha256)}</dd></div>
            <div><dt>Certificate</dt><dd>{shortHash(app.latestRelease.certificateSha256)}</dd></div>
          </dl>
        </section>

        <section className="permission-section" aria-labelledby="permissions-heading">
          <div className="section-title-row">
            <div><p className="eyebrow">Data & privacy</p><h2 id="permissions-heading">Requested permissions</h2></div>
            <p>Declared by version {app.latestRelease.versionName}. Android still asks for runtime permissions when required.</p>
          </div>
          {app.latestRelease.permissions.length > 0 ? (
            <ul className="permission-list">
              {app.latestRelease.permissions.map((permission) => (
                <li key={permission}><strong>{friendlyPermission(permission)}</strong><span>{permission}</span></li>
              ))}
            </ul>
          ) : <p className="muted">No Android permissions were declared for this release.</p>}
        </section>

        <aside className="independence-note">
          <Image src="/hub-mark.png" alt="" width={64} height={64} />
          <div><strong>Independent by design.</strong><p>Solana Android Hub is an independent catalogue and is not affiliated with or endorsed by Solana Mobile.</p></div>
        </aside>
      </article>
    </main>
  );
}

function approvalLabel(status: "unknown" | "verified_approved" | "rejected"): string {
  if (status === "verified_approved") return "Independently verified";
  if (status === "rejected") return "Rejected";
  return "Not asserted";
}

function categoryFromApp(category: string): string {
  const labels: Record<string, string> = {
    "ai-agents": "AI & agents",
    "content-streaming": "Content & streaming",
    defi: "DeFi & trading",
    depin: "DePIN",
    games: "Games",
    lifestyle: "Lifestyle",
    nfts: "NFTs",
    "privacy-security": "Privacy & security",
    productivity: "Productivity",
    "social-identity": "Social & identity",
    wallets: "Wallets"
  };
  return labels[category] ?? "More tools";
}

function androidVersion(minSdk: number): string {
  const versions: Record<number, string> = { 26: "8", 27: "8.1", 28: "9", 29: "10", 30: "11", 31: "12", 32: "12L", 33: "13", 34: "14", 35: "15", 36: "16" };
  return versions[minSdk] ?? `API ${minSdk}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  return `${(bytes / 1_000_000).toFixed(bytes >= 100_000_000 ? 0 : 1)} MB`;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-10)}`;
}

function friendlyPermission(permission: string): string {
  const names: Record<string, string> = {
    "android.permission.CAMERA": "Camera",
    "android.permission.INTERNET": "Internet access",
    "android.permission.POST_NOTIFICATIONS": "Notifications",
    "android.permission.RECORD_AUDIO": "Microphone",
    "android.permission.READ_MEDIA_IMAGES": "Photos",
    "android.permission.ACCESS_FINE_LOCATION": "Precise location"
  };
  return names[permission] ?? permission.split(".").at(-1)?.replaceAll("_", " ").toLocaleLowerCase() ?? permission;
}
