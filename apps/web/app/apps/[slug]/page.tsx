import { notFound } from "next/navigation";
import { getCatalogApp } from "../../../server/catalog-service";

export const dynamic = "force-dynamic";

export default async function AppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await getCatalogApp(slug, "trusted");
  if (!app) notFound();
  return (
    <main>
      <article className="detail-shell">
        <div className="app-icon large" aria-hidden="true">{app.name.slice(0, 1)}</div>
        <div>
          <p className="eyebrow">{app.latestRelease.previewOnly ? "Development preview" : "Verified publisher release"}</p>
          <h1>{app.name}</h1>
          <p className="lede">{app.description ?? app.shortDescription}</p>
        </div>
        <dl className="facts">
          <div><dt>Publisher control</dt><dd>Verified</dd></div>
          <div><dt>Distribution consent</dt><dd>Active</dd></div>
          <div><dt>Release authenticity</dt><dd>{app.latestRelease.trust.releaseAuthenticity.replaceAll("_", " ")}</dd></div>
          <div><dt>Solana Mobile approval</dt><dd>{app.latestRelease.trust.solanaMobileApproval.replaceAll("_", " ")}</dd></div>
        </dl>
        <section>
          <h2>Android release</h2>
          <p>{app.latestRelease.packageName} · version {app.latestRelease.versionName} ({app.latestRelease.versionCode})</p>
          <p className="muted">The Android Hub validates the full APK hash, package, version, and signing certificate again on-device before opening PackageInstaller.</p>
        </section>
      </article>
    </main>
  );
}
