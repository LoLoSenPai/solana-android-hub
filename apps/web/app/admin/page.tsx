import Link from "next/link";
import { getAdminOverview, getPublicationHealth, isAdmin } from "../../server/admin-service";
import { getCurrentSession } from "../../server/session-service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!isAdmin(session)) {
    return <main><section className="hero compact"><p className="eyebrow">Admin operations</p><h1>Allowlisted wallet required.</h1><p>Sign in with your admin wallet in the <Link href="/publisher"><u>publisher workspace</u></Link>, then return here.</p></section></main>;
  }
  const [overview, health] = await Promise.all([
    getAdminOverview(session),
    getPublicationHealth(session).catch(() => null)
  ]);
  return (
    <main>
      <section className="hero compact"><p className="eyebrow">Admin operations</p><h1>Evidence before status.</h1><p>Suspension, independent approval evidence, quarantine, and validator diagnostics are separate operational facts.</p></section>
      <section className="admin-grid">
        <section className="panel" aria-labelledby="publication-health">
          <h2 id="publication-health">Publication health</h2>
          {health === null ? <p role="alert">Publication health could not be loaded.</p> :
            health.issues.length === 0 ? <p>No current publication blockers.</p> :
            <ul>{health.issues.map((issue) => (
              <li key={`${issue.app}-${issue.code}-${issue.version ?? ""}`}>
                <strong>{issue.app}</strong>{issue.version && ` · build ${issue.version}`}
                <br /><code>{issue.code}</code>
                {issue.validationId && <details><summary>Validation ID</summary><code>{issue.validationId}</code></details>}
              </li>
            ))}</ul>}
          {health?.truncated && <p>Showing the first {health.issues.length} incidents.</p>}
        </section>
        <div className="panel"><h2>Apps</h2>{overview.apps.map((app) => <p key={app.id}><strong>{app.name}</strong><br /><span className="muted">{app.claimStatus} · distribution {String(app.distributionEnabled)}</span></p>)}</div>
        <div className="panel"><h2>Releases</h2>{overview.releases.map((release) => <p key={release.id}><strong>{release.appName} v{release.versionName}</strong><br /><span className="muted">{release.validationStatus} · {release.publicationStatus} · approval {release.approvalStatus}</span></p>)}</div>
        <div className="panel"><h2>Append-only audit</h2>{overview.audits.map((audit) => <p key={audit.id}><strong>{audit.action}</strong><br /><span className="muted">{audit.reason} · {audit.createdAt.toISOString()}</span></p>)}</div>
      </section>
    </main>
  );
}
