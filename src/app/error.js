"use client";

export default function Error({ error, reset }) {
  return (
    <section className="section" role="alert" aria-live="assertive">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Something went wrong</span>
          <h2>We hit an unexpected error.</h2>
        </div>
        <p>{error?.message || "Please try again. If the problem persists, contact support."}</p>
      </div>
      <button className="button" type="button" onClick={() => reset()}>
        Try again
      </button>
    </section>
  );
}
