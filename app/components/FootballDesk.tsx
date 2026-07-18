import Link from "next/link";
import { upcomingFixtures } from "@/lib/fixtures";
import { formatNewsDate, latestNews } from "@/lib/news";
import { matchProb } from "@/lib/model";
import { Kickoff } from "./Kickoff";

function outcomeLabel(home: string, away: string, probabilities: ReturnType<typeof matchProb>) {
  const outcomes = [
    { label: home, value: probabilities.home },
    { label: "Draw", value: probabilities.draw },
    { label: away, value: probabilities.away },
  ].sort((a, b) => b.value - a.value);
  return outcomes[0];
}

export function FootballDesk() {
  const stories = latestNews(8);
  const lead = stories.find((story) => story.img) ?? stories[0];
  const headlines = stories.filter((story) => story.link !== lead?.link).slice(0, 4);
  const watchlist = upcomingFixtures(18)
    .filter((fixture, index, fixtures) => (
      fixtures.findIndex((item) => item.league.slug === fixture.league.slug) === index
    ))
    .slice(0, 3);

  if (!lead) return null;

  return (
    <section className="home-section football-desk wrap" aria-labelledby="football-desk-title" data-reveal>
      <header className="desk-heading">
        <div>
          <p className="section-index">The football desk</p>
          <h2 id="football-desk-title">Know what happened. See what comes next.</h2>
        </div>
        <Link className="text-action" href="/news/">All news &amp; analysis <span aria-hidden>→</span></Link>
      </header>

      <div className="desk-grid">
        <a className="desk-lead" href={lead.link} target="_blank" rel="noopener nofollow">
          {lead.img && (
            <span className="desk-lead-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lead.img} alt="" loading="eager" />
              <span className="desk-image-scan" aria-hidden />
            </span>
          )}
          <span className="desk-story-meta mono">
            <span>Lead story</span>
            <span>{lead.src} · {formatNewsDate(lead.date)}</span>
          </span>
          <h3>{lead.title}</h3>
          <span className="desk-open">Read at {lead.src} <i aria-hidden>↗</i></span>
        </a>

        <div className="desk-headlines" aria-label="Latest headlines">
          <div className="desk-column-head">
            <span>Latest reports</span>
            <span>Source / UTC</span>
          </div>
          {headlines.map((story, index) => (
            <a key={story.link} className="desk-headline" href={story.link} target="_blank" rel="noopener nofollow">
              <span className="desk-headline-index mono">{String(index + 1).padStart(2, "0")}</span>
              <span>
                <b>{story.title}</b>
                <small className="mono">{story.src} · {formatNewsDate(story.date)}</small>
              </span>
              <i aria-hidden>↗</i>
            </a>
          ))}
        </div>

        <aside className="desk-watch" aria-label="Matches to watch">
          <div className="desk-column-head">
            <span>Model watch</span>
            <Link href="/matches/">All fixtures ↗</Link>
          </div>
          {watchlist.map((fixture) => {
            const probabilities = matchProb(fixture.home.elo, fixture.away.elo);
            const lean = outcomeLabel(fixture.home.club, fixture.away.club, probabilities);
            return (
              <Link className="desk-watch-row" href={`/match/${fixture.slug}/`} key={fixture.id}>
                <span className="desk-watch-meta mono">
                  <span>{fixture.league.name}</span>
                  <Kickoff iso={fixture.date} />
                </span>
                <strong>{fixture.home.club} <i>v</i> {fixture.away.club}</strong>
                <span className="desk-watch-lean">
                  <span>Model lean · {lean.label}</span>
                  <b className="tnum">{(lean.value * 100).toFixed(1)}%</b>
                </span>
              </Link>
            );
          })}
          <p className="desk-watch-note">Pre-match probabilities, not live scores. Forecasts lock at kickoff.</p>
        </aside>
      </div>
    </section>
  );
}
