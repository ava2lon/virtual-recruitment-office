const features = [
  { number: "01", title: "Make your next move", text: "Build a clear profile, surface relevant opportunities, and keep your search organised." },
  { number: "02", title: "Find the right fit", text: "Bring candidate skills and employer needs into one focused recruitment experience." },
  { number: "03", title: "Move forward together", text: "Track applications and keep the next step visible for candidates and teams." },
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> Talent meets opportunity</div>
          <h1>Good work starts with <span className="accent-text">the right connection.</span></h1>
          <p className="hero-description">A simpler way for people to find meaningful work and for teams to discover the talent that moves them forward.</p>
          <div className="hero-actions">
            <a className="button" href="/signup">Find your next opportunity <span aria-hidden="true">↗</span></a>
            <a className="button button-secondary" href="/employer">I’m hiring</a>
          </div>
          <div className="hero-proof"><div className="avatar-stack"><span>J</span><span>A</span><span>K</span></div><p><strong>Built around people.</strong><br />Designed for the next step.</p></div>
        </div>
        <div className="hero-art" aria-label="Abstract illustration of connected talent and opportunity">
          <div className="orbit orbit-one"></div><div className="orbit orbit-two"></div>
          <div className="floating-card card-top"><span className="mini-icon">✳</span><div><strong>Better matches</strong><small>Skills meet opportunity</small></div><span className="status-dot"></span></div>
          <div className="hero-emblem"><div className="emblem-core">W</div><span className="emblem-caption">WORK<br />BRIDGE</span></div>
          <div className="floating-card card-bottom"><span className="mini-icon mini-icon-dark">↗</span><div><strong>Next step unlocked</strong><small>One connection at a time</small></div></div>
          <span className="spark spark-one">✳</span><span className="spark spark-two">✦</span><span className="spark spark-three">·</span>
        </div>
      </section>
      <section className="trust-strip"><span>MADE FOR THE NEXT CHAPTER</span><div><strong>Talent</strong><i>×</i><strong>Opportunity</strong><i>×</i><strong>Momentum</strong></div></section>
      <section className="section section-features">
        <div className="section-heading"><div><span className="eyebrow">A better way forward</span><h2>Less friction.<br /><span className="muted-text">More possibility.</span></h2></div><p>Whether you’re building a career or a team, WorkBridge keeps the important things connected.</p></div>
        <div className="feature-grid">{features.map((feature) => <article className="feature-card" key={feature.number}><span className="feature-number">{feature.number}</span><div className="feature-arrow">↗</div><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
      </section>
      <section className="closing-cta"><div><span className="eyebrow">Your next step starts here</span><h2>Make the connection.</h2></div><a className="button button-light" href="/signup">Join WorkBridge <span aria-hidden="true">↗</span></a></section>
    </>
  );
}
