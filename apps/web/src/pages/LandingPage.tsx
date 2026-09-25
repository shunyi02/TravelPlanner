import { CalendarDots, ChartPieSlice, Receipt, UsersThree } from '@phosphor-icons/react';

const FEATURES = [
  {
    icon: CalendarDots,
    title: 'Plan day by day',
    body: "Add stops, hotels and flights to a day-by-day itinerary, with a route map and that day's weather right alongside it.",
  },
  {
    icon: Receipt,
    title: 'Split every expense fairly',
    body: 'Log what was spent, snap the receipt, and let service charge and tax split automatically across whoever owes.',
  },
  {
    icon: UsersThree,
    title: 'Built for big groups',
    body: "Big trip, different plans? Some people can peel off for their own stops on the same day, and everyone still sees one shared itinerary.",
  },
  {
    icon: ChartPieSlice,
    title: 'Stay on budget',
    body: 'Track spend against a budget, see who owes who, and export a report or your itinerary as a PDF before you go.',
  },
];

export function LandingPage({
  onLogin,
  onGetStarted,
}: {
  onLogin: () => void;
  onGetStarted: () => void;
}) {
  return (
    <div className="landing">
      <header className="landing-bar">
        <div className="top-bar-brand">
          <span className="top-bar-logo" />
          <span className="top-bar-name">Cuti</span>
        </div>
        <button type="button" className="btn btn-outline" onClick={onLogin}>
          Log in
        </button>
      </header>

      <main id="main-content">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1>The trip plan everyone can actually follow.</h1>
            <p>
              One itinerary and one shared ledger for the whole group, from a weekend for two to
              fifteen people who split up most days.
            </p>
            <button type="button" className="btn landing-cta" onClick={onGetStarted}>
              Start planning
            </button>
          </div>
          {/* One screenshot per mode; CSS shows the one matching the page theme. */}
          <div className="landing-hero-art">
            <img
              className="landing-hero-shot landing-hero-shot-light"
              src="/hero-itinerary-light.jpg"
              alt="A Cuti trip page: the Guangzhou trip banner with stops, trip length and currency, day-by-day tabs, and the route map"
              width={535}
              height={710}
            />
            <img
              className="landing-hero-shot landing-hero-shot-dark"
              src="/hero-itinerary-dark.jpg"
              alt="A Cuti trip page: the Guangzhou trip banner with stops, trip length and currency, day-by-day tabs, and the route map"
              width={535}
              height={710}
              loading="lazy"
            />
          </div>
        </section>

        <section className="landing-features">
          {FEATURES.map(({ icon: FeatureIcon, title, body }) => (
            <div className="landing-feature card" key={title}>
              <FeatureIcon className="landing-feature-icon" size={28} weight="duotone" aria-hidden />
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <p>Free to use with anyone you're travelling with.</p>
          <button type="button" className="btn" onClick={onGetStarted}>
            Start planning
          </button>
        </div>
      </footer>

      <footer className="landing-site-footer">
        <div className="landing-site-footer-inner">
          <a className="landing-site-footer-link" href="mailto:hello@cuti.app">
            Contact us
          </a>
          <div className="landing-site-footer-credits">
            <p>
              Map data ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                OpenStreetMap
              </a>{' '}
              contributors · place suggestions from{' '}
              <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer">
                Wikidata
              </a>
            </p>
          </div>
        </div>
        <p className="landing-site-footer-powered-by">
          Powered by{' '}
          <a href="https://shinto.co" target="_blank" rel="noopener noreferrer">
            Shinto.co
          </a>
        </p>
      </footer>
    </div>
  );
}
