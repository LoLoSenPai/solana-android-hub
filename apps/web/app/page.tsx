import Link from "next/link";
import { listCatalog } from "../server/catalog-service";
import { hubConfig } from "../server/runtime";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const apps = await listCatalog({ channel: "trusted" });
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Standalone Android catalogue</p>
        <h1>Apps with explicit publisher consent.</h1>
        <p>Publisher control, release authenticity, distribution consent, and Solana Mobile approval remain separate facts.</p>
        {hubConfig.appEnvironment !== "production" && <span className="preview-banner">Development preview · never production verified</span>}
      </section>
      <section aria-labelledby="catalogue-heading">
        <div className="section-heading">
          <h2 id="catalogue-heading">Discover</h2>
          <span>{apps.length} eligible {apps.length === 1 ? "app" : "apps"}</span>
        </div>
        <div className="app-grid">
          {apps.map((app) => (
            <Link className="app-card" href={`/apps/${app.slug}`} key={app.id}>
              <div className="app-icon" aria-hidden="true">{app.name.slice(0, 1)}</div>
              <div>
                <h3>{app.name}</h3>
                <p>{app.shortDescription ?? app.latestRelease.packageName}</p>
                <div className="trust-row">
                  <span>{app.latestRelease.previewOnly ? "Development preview" : "Verified publisher release"}</span>
                  <span>v{app.latestRelease.versionName}</span>
                </div>
              </div>
            </Link>
          ))}
          {apps.length === 0 && <div className="empty-state">No releases are eligible in this environment yet.</div>}
        </div>
      </section>
    </main>
  );
}
