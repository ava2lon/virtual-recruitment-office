import "./globals.css";
import "./design-tokens.css";
import "./visual-effects.css";
import "./application-tracker.css";
import NotificationCenter from "../components/NotificationCenter";
import ThemeToggle from "../components/ThemeToggle";
import HeaderNav from "../components/HeaderNav";
import CommandPalette from "../components/CommandPalette";

export const metadata = {
  title: "WorkBridge — One platform. Zero friction.",
  description: "A smarter connection between talent and opportunity.",
  openGraph: {
    title: "WorkBridge — One platform. Zero friction.",
    description: "A smarter connection between talent and opportunity.",
    images: ["/api/og?title=WorkBridge"],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <header className="site-header">
          <a className="brand" href="/" aria-label="WorkBridge home">
            <span className="brand-mark">W</span><span>workbridge</span>
          </a>
          <HeaderNav />
          <div className="header-actions">
            <NotificationCenter />
            <ThemeToggle />
            <a className="login-link" href="/login">Log in</a>
            <a className="button button-small" href="/signup">Get started</a>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <CommandPalette />
        <footer className="site-footer">
          <a className="brand brand-footer" href="/"><span className="brand-mark">W</span><span>workbridge</span></a>
          <p>One platform. Zero friction. One connection.</p>
          <span>© {new Date().getFullYear()} WorkBridge</span>
        </footer>
      </body>
    </html>
  );
}
