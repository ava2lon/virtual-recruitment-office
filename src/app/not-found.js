import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">404</span>
          <h2>This page could not be found.</h2>
        </div>
        <p>The link may be broken or the page may have moved.</p>
      </div>
      <Link className="button" href="/">
        Back to home
      </Link>
    </section>
  );
}
