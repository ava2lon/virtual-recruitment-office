import { cookies } from "next/headers";
import { verifySessionToken } from "../../lib/oauth/session";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("wb_session")?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return (
      <section className="page-shell">
        <div className="empty-state">
          <span className="empty-symbol">🔒</span>
          <h2>Sign in required</h2>
          <p>Please log in to access your dashboard.</p>
          <a className="button" href="/login">Log in</a>
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <div className="page-intro">
        <span className="eyebrow">Dashboard</span>
        <h1>Welcome back</h1>
        <p>Signed in as {session.email}.</p>
      </div>
      <div className="wb-card">
        <p>Your account session is active. Use the navigation to explore WorkBridge.</p>
        <form action="/api/auth/logout" method="post" style={{ marginTop: "1rem" }}>
          <button type="submit" className="button">Log out</button>
        </form>
      </div>
    </section>
  );
}
