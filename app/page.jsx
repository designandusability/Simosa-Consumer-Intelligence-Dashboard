import { ChartNoAxesCombined, LogOut } from "lucide-react";
import Link from "next/link";
import { platformName } from "../lib/brand.mjs";
import { firebaseConfig, viewer } from "../lib/auth";
import { canAccessDashboard, dashboards, simosaDashboard } from "../lib/dashboard-access.mjs";
import Dashboard from "../components/dashboard";
import FirebaseLogin from "../components/firebase-login";
import PortalFrame from "../components/portal-frame";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }) {
  const user = await viewer();
  if (user) {
    const available = dashboards.filter(({ id }) => canAccessDashboard(user.dashboardClaims, id));
    const { dashboard } = await searchParams;
    const selected = dashboard === undefined ? available[0] : available.find(({ id }) => id === dashboard);

    return <PortalFrame sidebar={<>
        <div className="portal-identity"><span>Jazz Lifestyle Ventures</span><strong>{platformName}</strong></div>
        <nav className="portal-nav" aria-label="Application dashboards">
          {available.map(({ id, name, logo }) => <Link key={id} href={`/?dashboard=${id}`}
            aria-current={selected?.id === id ? "page" : undefined}>
            {logo ? <img className="portal-app-logo" src={logo} alt="" width={24} height={24} />
              : <ChartNoAxesCombined size={17} aria-hidden="true" />}
            {name}
          </Link>)}
        </nav>
        <form className="portal-sign-out" action="/api/auth/logout" method="post">
          <button className="button ghost" type="submit"><LogOut size={16} aria-hidden="true" /> Sign out</button>
        </form>
    </>}>
      {selected?.id === simosaDashboard.id ? <Dashboard /> :
        <main className="workspace portal-empty">
          <h1>{available.length ? "Dashboard unavailable" : "No dashboards assigned"}</h1>
          <p>{available.length ? "Choose a dashboard from the navigation." : "Contact the dashboard administrator to request access."}</p>
        </main>}
    </PortalFrame>;
  }

  const config = firebaseConfig();
  return <main className="login-layout">
    <section className="login-card" aria-labelledby="login-title">
      <img className="login-logo" src="/brand/jazzworld.png" alt="JazzWorld" width="80" height="68" />
      <p className="eyebrow login-organization">Jazz Lifestyle Ventures</p>
      <h1 id="login-title">{platformName}</h1>
      <p>Sign in with your Jazz work email.</p>
      {config ? <FirebaseLogin config={config} /> :
        <p className="notice" role="status">Sign-in setup is pending. Contact the dashboard administrator.</p>}
    </section>
  </main>;
}
