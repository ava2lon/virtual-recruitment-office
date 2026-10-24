const features = [
  { number: "01", title: "Make your next move", text: "Build a standout profile, discover relevant opportunities, and keep every application in view.", icon: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="8" /></> },
  { number: "02", title: "Find the right fit", text: "Bring candidate skills and employer needs together in one focused recruitment experience.", icon: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M8 10.5l1.7 1.7 3.8-4" /></> },
  { number: "03", title: "Move forward together", text: "Track applications and keep the next step clear for candidates and hiring teams.", icon: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8 12 2.5 2.5L16 9" /></> },
];

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M7 5h12v12" /></svg>;
}

export default function HomePage() {
  return (
    <>
      <section className="hero hero-redesign">
        <div className="hero-copy hero-copy-reveal">
          <div className="eyebrow"><span className="eyebrow-dot" /> Talent meets opportunity</div>
          <h1>Good work starts with <span className="accent-text headline-highlight">the right connection.</span></h1>
          <p className="hero-description">A simpler way for people to find meaningful work and for teams to discover the talent that moves them forward.</p>
          <div className="hero-actions">
            <a className="button hero-primary" href="/signup">Find your next opportunity <span aria-hidden="true">↗</span></a>
            <a className="button button-secondary hero-secondary" href="/employer">I’m hiring <span aria-hidden="true">→</span></a>
          </div>
          <div className="hero-proof"><div className="avatar-stack"><span>J</span><span>A</span><span>K</span></div><p><strong>Built around people.</strong><br />Designed for the next step.</p></div>
        </div>
        <div className="hero-art hero-art-redesign" aria-label="WorkBridge connects candidate profiles with opportunities and hiring teams">
          <div className="art-glow art-glow-one" /><div className="art-glow art-glow-two" /><div className="art-grid" />
          <svg className="connection-lines" viewBox="0 0 520 460" fill="none" aria-hidden="true">
            <path className="connection-path path-one" d="M72 100 C145 100 142 170 218 170 S322 78 438 112" />
            <path className="connection-path path-two" d="M72 350 C148 350 156 278 240 278 S350 370 448 330" />
            <path className="connection-path path-three" d="M260 56 C260 126 260 150 260 230 S260 320 260 404" />
            <circle cx="72" cy="100" r="5" fill="#C6E777" /><circle cx="438" cy="112" r="5" fill="#C6E777" /><circle cx="72" cy="350" r="5" fill="#C6E777" /><circle cx="448" cy="330" r="5" fill="#C6E777" />
          </svg>
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="hero-emblem hero-emblem-redesign"><div className="emblem-core">W</div><span className="emblem-caption">WORK<br />BRIDGE</span><span className="emblem-ring" /></div>
          <div className="floating-card card-top card-glass"><span className="mini-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" /></svg></span><div><strong>Better matches</strong><small>Skills meet opportunity</small></div><span className="status-dot" /></div>
          <div className="floating-card card-bottom card-glass"><span className="mini-icon mini-icon-dark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg></span><div><strong>Next step unlocked</strong><small>One connection at a time</small></div></div>
          <div className="art-chip chip-profile"><span className="chip-avatar">P</span><span><strong>Your profile</strong><small>Skills, experience, goals</small></span><span className="chip-check">✓</span></div>
          <div className="art-chip chip-opportunity"><span className="chip-icon">↗</span><span><strong>New opportunity</strong><small>A role worth exploring</small></span></div>
          <span className="spark spark-one">✳</span><span className="spark spark-two">✦</span><span className="spark spark-three">·</span>
        </div>
      </section>
      <section className="trust-strip trust-strip-redesign"><span>MADE FOR THE NEXT CHAPTER</span><div><strong>Talent</strong><i>×</i><strong>Opportunity</strong><i>×</i><strong>Momentum</strong></div></section>
      <section className="section section-features feature-section-redesign">
        <div className="section-heading"><div><span className="eyebrow">A better way forward</span><h2>Less friction.<br /><span className="muted-text">More possibility.</span></h2></div><p>Whether you’re building a career or a team, WorkBridge keeps the important things connected.</p></div>
        <div className="feature-grid feature-grid-redesign">{features.map((feature) => <article className="feature-card feature-card-redesign" key={feature.number}><div className="feature-card-top"><span className="feature-number">{feature.number}</span><span className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{feature.icon}</svg></span></div><div className="feature-arrow"><ArrowIcon /></div><h3>{feature.title}</h3><p>{feature.text}</p><span className="feature-bottom-line" /></article>)}</div>
      </section>
      <section className="journey-band">
        <div className="journey-copy"><span className="eyebrow">A clearer path forward</span><h2>From first hello<br /><span>to what’s next.</span></h2><p>Bring the important moments of the job search into one connected experience.</p><a className="text-link journey-link" href="/signup">Start your journey <span aria-hidden="true">↗</span></a></div>
        <div className="journey-steps">
          <div className="journey-step"><span className="journey-step-icon">01</span><div><strong>Build your profile</strong><p>Make your skills and experience easy to understand.</p></div><span className="journey-step-check">✓</span></div>
          <div className="journey-connector"><span /></div>
          <div className="journey-step"><span className="journey-step-icon">02</span><div><strong>Discover your fit</strong><p>Explore roles that line up with your next move.</p></div><span className="journey-step-check">✓</span></div>
          <div className="journey-connector"><span /></div>
          <div className="journey-step"><span className="journey-step-icon">03</span><div><strong>Keep momentum</strong><p>Track applications and see where things stand.</p></div><span className="journey-step-check">✓</span></div>
        </div>
        <div className="journey-decoration journey-decoration-one" /><div className="journey-decoration journey-decoration-two" />
      </section>
      <section className="closing-cta closing-cta-redesign"><div><span className="eyebrow">Your next step starts here</span><h2>Make the connection.</h2><p>One platform. Zero friction. One connection.</p></div><a className="button button-light" href="/signup">Join WorkBridge <span aria-hidden="true">↗</span></a><span className="cta-orbit cta-orbit-one" /><span className="cta-orbit cta-orbit-two" /></section>
    </>
  );
}
