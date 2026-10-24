import "./globals.css";
import "./visual-effects.css";
import NotificationCenter from "../components/NotificationCenter";

export const metadata = {
  title: "WorkBridge — One platform. Zero friction.",
  description: "A smarter connection between talent and opportunity.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/" aria-label="WorkBridge home">
            <span className="brand-mark">W</span><span>workbridge</span>
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="/matches">Find jobs</a>
            <a href="/employer">For employers</a>
            <a href="/profile">My profile</a>
          </nav>
          <div className="header-actions">
            <NotificationCenter />
            <a className="login-link" href="/login">Log in</a>
            <a className="button button-small" href="/signup">Get started</a>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <a className="brand brand-footer" href="/"><span className="brand-mark">W</span><span>workbridge</span></a>
          <p>One platform. Zero friction. One connection.</p>
          <span>© {new Date().getFullYear()} WorkBridge</span>
        </footer>
      </body>
    </html>
  );
}
