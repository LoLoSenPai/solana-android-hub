import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { Compass } from "@phosphor-icons/react/dist/ssr/Compass";
import { DeviceMobile } from "@phosphor-icons/react/dist/ssr/DeviceMobile";
import { Fingerprint } from "@phosphor-icons/react/dist/ssr/Fingerprint";
import { DiscordLogo } from "@phosphor-icons/react/dist/ssr/DiscordLogo";
import { GlobeHemisphereWest } from "@phosphor-icons/react/dist/ssr/GlobeHemisphereWest";
import { SealCheck } from "@phosphor-icons/react/dist/ssr/SealCheck";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { Signature } from "@phosphor-icons/react/dist/ssr/Signature";
import { UserFocus } from "@phosphor-icons/react/dist/ssr/UserFocus";
import { TelegramLogo } from "@phosphor-icons/react/dist/ssr/TelegramLogo";
import { XLogo } from "@phosphor-icons/react/dist/ssr/XLogo";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ScreenshotRail } from "../../components/ScreenshotRail";
import { catalogChannelFromParam, catalogHref } from "../../catalog/catalog-channel";
import { buildAppSocialMetadata } from "../../../server/app-social-metadata";
import { getCatalogApp } from "../../../server/catalog-service";

export const dynamic = "force-dynamic";

const getChannelCatalogApp = cache((slug: string, channel: "approved" | "trusted") => getCatalogApp(slug, channel));

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ channel?: string | string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const channel = catalogChannelFromParam((await searchParams).channel);
  const app = await getChannelCatalogApp(slug, channel);
  if (!app) {
    return {
      title: "App unavailable",
      robots: { index: false, follow: false }
    };
  }
  return buildAppSocialMetadata(app);
}

export default async function AppDetailPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ channel?: string | string[] }>;
}) {
  const { slug } = await params;
  const channel = catalogChannelFromParam((await searchParams).channel);
  const app = await getChannelCatalogApp(slug, channel);
  if (!app) notFound();

  const authenticity = app.latestRelease.previewOnly ? "Development preview" : "Server-validated release";
  const approval = approvalLabel(app.latestRelease.trust.solanaMobileApproval);
  const heroArtwork = app.bannerUrl ?? app.featureGraphicUrl ?? app.screenshots[0];
  const publisherLinks = [
    { label: "Website", url: app.publisherLinks.website, Icon: GlobeHemisphereWest },
    { label: "X", url: app.publisherLinks.x, Icon: XLogo },
    { label: "Discord", url: app.publisherLinks.discord, Icon: DiscordLogo },
    { label: "Telegram", url: app.publisherLinks.telegram, Icon: TelegramLogo }
  ].flatMap((link) => link.url ? [{ ...link, url: link.url }] : []);

  return (
    <main className="app-detail-page">
      <article>
        <div className="detail-back-row">
          <Link className="text-link" href={catalogHref({ channel })}>Back to catalogue</Link>
          <span>{app.latestRelease.packageName}</span>
        </div>

        <section className="detail-intro" aria-labelledby="app-title">
          {app.iconUrl
            // Publisher icon hosts are metadata-driven, so they stay direct instead of enabling a broad Next image proxy allowlist.
            ? <img className="detail-app-icon" src={app.iconUrl} alt={`${app.name} icon`} />
            : <Image className="detail-app-icon" src="/dapport-app-fallback.png" width={160} height={160} alt={`${app.name} icon`} />}
          <div className="detail-title-copy">
            <p className="eyebrow">{categoryFromApp(app.category)}</p>
            <h1 id="app-title">{app.name}</h1>
            <p>{app.shortDescription ?? "A publisher-authorized Android app for the Solana ecosystem."}</p>
          </div>
          <div className="detail-primary-action">
            <Link className="primary-action" href="/download">Install with Dapport</Link>
            <a
              className="secondary-action"
              href={app.latestRelease.apkUrl}
              target="_blank"
              rel="noreferrer nofollow"
              referrerPolicy="no-referrer"
            >
              Download APK directly
            </a>
            <small>Dapport checks this release on your phone. Direct download is an advanced option that skips those final device checks.</small>
          </div>
        </section>

        <section className="detail-showcase" aria-label={`${app.name} artwork and installation overview`}>
          <div className="detail-hero">
            {heroArtwork ? (
              <>
                <img className="detail-hero-backdrop" src={heroArtwork} alt="" aria-hidden="true" />
                <img className="detail-hero-image" src={heroArtwork} alt={`${app.name} cover artwork`} />
              </>
            ) : <Image className="detail-hero-image" src="/dapport-hero-chromatic.webp" alt="" fill priority sizes="(max-width: 760px) 100vw, 900px" />}
            <span className="detail-hero-scrim" aria-hidden="true" />
            <span className="detail-state">{authenticity}</span>
          </div>
          <aside className="detail-flow-card">
            <div><p className="eyebrow">Install & manage with Dapport</p><h2>A simple 3-step flow.</h2><p>Discover on the web. Install and manage on Android.</p></div>
            <ol>
              <li><Compass aria-hidden="true" weight="duotone" /><span><strong>Browse on the web</strong><small>Choose the app and release that fits you.</small></span></li>
              <li><DeviceMobile aria-hidden="true" weight="duotone" /><span><strong>Continue on Android</strong><small>Open Dapport and run the device checks.</small></span></li>
              <li><ArrowsClockwise aria-hidden="true" weight="duotone" /><span><strong>Manage updates</strong><small>Keep apps installed through Dapport current.</small></span></li>
            </ol>
            <dl>
              <div><dt>Category</dt><dd>{categoryFromApp(app.category)}</dd></div>
              <div><dt>Compatibility</dt><dd>Android {androidVersion(app.latestRelease.minSdk)}+</dd></div>
              <div><dt>Version</dt><dd>{app.latestRelease.versionName}</dd></div>
            </dl>
          </aside>
        </section>

        <section className={`detail-description editorial-split${app.featureGraphicUrl ? " has-feature-art" : ""}`} aria-labelledby="about-heading">
          <div>
            <p className="eyebrow">About this app</p>
            <h2 id="about-heading">A clear view before you install.</h2>
          </div>
          <div className="detail-about-copy"><p>{app.description ?? app.shortDescription ?? "The publisher has not provided a longer description for this release yet."}</p></div>
        </section>

        {publisherLinks.length > 0 ? (
          <section className="detail-publisher-links" aria-labelledby="publisher-links-heading">
            <div>
              <p className="eyebrow">Publisher-provided</p>
              <h2 id="publisher-links-heading">Follow &amp; support</h2>
              <p>Official destinations supplied by the current publisher of {app.name}.</p>
            </div>
            <div className="detail-publisher-link-list">
              {publisherLinks.map(({ label, url, Icon }) => (
                <a href={url} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" key={label}>
                  <Icon aria-hidden="true" weight="duotone" /><span>{label}</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {app.screenshots.length > 0 ? (
          <section className="screenshot-section" aria-labelledby="screenshots-heading">
            <div className="section-title-row">
              <h2 id="screenshots-heading">Preview</h2>
              <span>{app.screenshots.length} images · drag to explore</span>
            </div>
            {/* Publisher screenshot hosts are validated metadata, but remain direct to avoid a broad image-proxy allowlist. */}
            <ScreenshotRail appName={app.name} screenshots={app.screenshots} />
          </section>
        ) : (
          <section className="detail-editorial-card" aria-label="Dapport installation promise">
            <Image src="/dapport-hero-chromatic.webp" alt="" fill sizes="(max-width: 760px) 100vw, 1280px" />
            <div><p className="eyebrow">A safer hand-off</p><h2>The APK is checked before Android ever sees it.</h2><p>Hash, package, version, minimum SDK, permissions, and signing certificate must all match the published release.</p></div>
          </section>
        )}

        <section className="detail-trust" aria-labelledby="trust-facts-heading">
          <div className="section-title-row">
            <div><p className="eyebrow">Visible evidence</p><h2 id="trust-facts-heading">Trust facts</h2></div>
            <p>These checks answer different questions. None of them becomes a vague “safe” badge.</p>
          </div>
          <dl className="detail-trust-grid">
            <div><UserFocus aria-hidden="true" weight="duotone" /><dt>Publisher control</dt><dd>Verified from current finalized authority evidence.</dd><strong>Verified</strong></div>
            <div><Signature aria-hidden="true" weight="duotone" /><dt>Distribution consent</dt><dd>A separate, environment-bound consent is active.</dd><strong>Active</strong></div>
            <div><Fingerprint aria-hidden="true" weight="duotone" /><dt>Release authenticity</dt><dd>The APK must match its published identity and certificate.</dd><strong>{authenticity}</strong></div>
            <div><SealCheck aria-hidden="true" weight="duotone" /><dt>Solana Mobile visibility</dt><dd>The current official release is matched by package and version.</dd><strong>{approval}</strong></div>
          </dl>
        </section>

        <section className="release-section" id="release" aria-labelledby="release-heading">
          <div className="release-copy">
            <p className="eyebrow">Current Android release</p>
            <h2 id="release-heading">Version {app.latestRelease.versionName}</h2>
            <p>Version code {app.latestRelease.versionCode} · requires Android {androidVersion(app.latestRelease.minSdk)} or newer · {formatFileSize(app.latestRelease.apkSize)}</p>
            <p className="muted">Dapport validates the full SHA-256, package name, version, and signing certificate again on-device before opening PackageInstaller.</p>
          </div>
          <dl className="release-facts">
            <div><dt>Package</dt><dd>{app.latestRelease.packageName}</dd></div>
            <div><dt>Target SDK</dt><dd>{app.latestRelease.targetSdk ? `API ${app.latestRelease.targetSdk}` : "Not declared"}</dd></div>
            <div><dt>APK SHA-256</dt><dd>{shortHash(app.latestRelease.apkSha256)}</dd></div>
            <div><dt>Certificate</dt><dd>{shortHash(app.latestRelease.certificateSha256)}</dd></div>
          </dl>
        </section>

        <section className="direct-download-note" aria-labelledby="direct-download-heading">
          <div>
            <p className="eyebrow">Desktop transfer</p>
            <h2 id="direct-download-heading">Need the APK file itself?</h2>
          </div>
          <div>
            <p>You can download the publisher-hosted APK from a computer and transfer it to Android. This does not run Dapport's installed-package, downgrade, or signer-conflict checks.</p>
            <a
              className="secondary-action"
              href={app.latestRelease.apkUrl}
              target="_blank"
              rel="noreferrer nofollow"
              referrerPolicy="no-referrer"
            >
              Download {app.name} APK
            </a>
            <p className="download-hash"><span>Expected SHA-256</span><code>{app.latestRelease.apkSha256}</code></p>
          </div>
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
          <ShieldCheck aria-hidden="true" weight="duotone" />
          <div><strong>Clear provenance by design.</strong><p>Dapport uses public Solana Mobile publishing metadata with separate publisher consent. It is not operated by or endorsed by Solana Mobile.</p></div>
        </aside>
      </article>
    </main>
  );
}

function approvalLabel(status: "unknown" | "verified_approved" | "rejected"): string {
  if (status === "verified_approved") return "Visible on Solana Mobile";
  return "Not verified by Solana Mobile";
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
  return labels[category] ?? "Other apps";
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
