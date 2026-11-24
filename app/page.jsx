import { Activity, LockKeyhole } from "lucide-react";
import { authClient, viewer } from "../lib/auth";
import Dashboard from "../components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }) {
  const configured = !!authClient();
  const session = configured ? await authClient().getSession() : null;
  const user = session ? await viewer() : null;
  if (user) return <Dashboard />;

  const { auth } = await searchParams;
  return <main className="login-layout">
    <div className="login-decoration" aria-hidden="true"><Activity /></div>
    <section className="login-card">
      <span className="brand-icon"><Activity size={23} /></span>
      <p className="eyebrow">Consumer intelligence</p>
      <h1>SIMOSA</h1>
      <p>Use your Jazz email and your SIMOSA dashboard password.</p>
      {!configured && <p className="notice" role="status">Sign-in setup is pending. Contact the dashboard administrator.</p>}
      {configured && auth === "failed" && <p className="notice" role="alert">Sign-in couldn’t be completed. Verify your Jazz email and try again.</p>}
      {session && !user && <p className="notice" role="alert">Your session expired or the sign-in requirements were not met.</p>}
      {configured && <a className="button primary" href={session ? "/auth/logout" : "/auth/login"}>
        {session ? "Sign out" : "Continue to sign in"}
      </a>}
      <p className="login-help"><LockKeyhole size={14} /> First visit? Select Sign up on the next screen.</p>
    </section>
  </main>;
}
