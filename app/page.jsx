import { firebaseConfig, viewer } from "../lib/auth";
import Dashboard from "../components/dashboard";
import FirebaseLogin from "../components/firebase-login";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await viewer()) return <Dashboard />;
  const config = firebaseConfig();

  return <main className="login-layout">
    <section className="login-card" aria-labelledby="login-title">
      <img className="login-logo" src="/brand/simosa.png" alt="SIMOSA" width="119" height="27" />
      <h1 id="login-title">Product Intelligence Dashboard</h1>
      <p>Use your Jazz work email to access SIMOSA.</p>
      {config ? <FirebaseLogin config={config} />
        : <p className="notice" role="status">Sign-in setup is pending. Contact the dashboard administrator.</p>}
    </section>
  </main>;
}
