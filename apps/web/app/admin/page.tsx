import { getAdminOverview, isAdmin } from "../../server/admin-service";
import { getCurrentSession } from "../../server/session-service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!isAdmin(session)) {
    return <main><section className="hero compact"><p className="eyebrow">Admin operations</p><h1>Allowlisted wallet required.</h1><p>Sign in through the publisher workspace with a configured admin wallet. Local development may leave the allowlist empty.</p></section></main>;
  }
  const overview = await getAdminOverview(session);
  return (
    <main>
      <section className="hero compact"><p className="eyebrow">Admin operations</p><h1>Evidence before status.</h1><p>Suspension, independent approval evidence, quarantine, and validator diagnostics are separate operational facts.</p></section>
      <section className="admin-grid">
        <div className="panel"><h2>Apps</h2>{overview.apps.map((app) => <p key={app.id}><strong>{app.name}</strong><br /><span className="muted">{app.claimStatus} · distribution {String(app.distributionEnabled)}</span></p>)}</div>
        <div className="panel"><h2>Releases</h2>{overview.releases.map((release) => <p key={release.id}><strong>{release.appName} v{release.versionName}</strong><br /><span className="muted">{release.validationStatus} · {release.publicationStatus} · approval {release.approvalStatus}</span></p>)}</div>
        <div className="panel"><h2>Append-only audit</h2>{overview.audits.map((audit) => <p key={audit.id}><strong>{audit.action}</strong><br /><span className="muted">{audit.reason} · {audit.createdAt.toISOString()}</span></p>)}</div>
      </section>
    </main>
  );
}
