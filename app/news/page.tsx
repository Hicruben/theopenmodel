import Link from "next/link";
import { allBriefs } from "@/lib/briefs";
import { clubBySlug } from "@/lib/data";
import { upcomingFixtures } from "@/lib/fixtures";
import { formatNewsDate, latestNews, newsUpdatedAt } from "@/lib/news";
import { matchProb } from "@/lib/model";
import { Crest } from "../components/Crest";
import { Kickoff } from "../components/Kickoff";

export const metadata = {
  title: "Football news, model analysis and upcoming forecasts",
  description: "The latest football reporting from trusted publishers, original model-impact briefs and the matches our forecast is watching next.",
};

function briefExcerpt(body: string) {
  return body
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export default function News() {
  const stories = latestNews(18);
  const lead = stories.find((story) => story.img) ?? stories[0];
  const remaining = stories.filter((story) => story.link !== lead?.link);
  const topStories = remaining.slice(0, 5);
  const stream = remaining.slice(5, 13);
  const briefs = allBriefs();
  const updated = newsUpdatedAt();
  const watchlist = upcomingFixtures(4);

  return (
    <main className="news-page">
      <section className="news-hero wrap" aria-labelledby="news-title">
        <div className="news-title-row">
          <div>
            <p className="news-kicker mono"><span aria-hidden /> The football desk</p>
            <h1 id="news-title">The game now.<br />The probabilities next.</h1>
          </div>
          <div className="news-title-copy">
            <p>Trusted reporting from across football, followed by our own numerical view of what changes — and what does not.</p>
            <span className="mono">External headlines link to their original publishers{updated ? ` · feed updated ${formatNewsDate(updated)}` : ""}</span>
          </div>
        </div>

        {lead && (
          <div className="news-top-grid">
            <a className="news-lead-story" href={lead.link} target="_blank" rel="noopener nofollow">
              {lead.img && (
                <span className="news-lead-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lead.img} alt="" />
                  <span aria-hidden className="news-image-grid" />
                </span>
              )}
              <span className="news-story-meta mono"><b>Lead report</b><span>{lead.src} · {formatNewsDate(lead.date)}</span></span>
              <h2>{lead.title}</h2>
              <span className="news-source-link">Continue at {lead.src} <i aria-hidden>↗</i></span>
            </a>

            <div className="news-top-list">
              <div className="news-list-head mono"><span>Latest</span><span>Publisher / UTC</span></div>
              {topStories.map((story, index) => (
                <a href={story.link} target="_blank" rel="noopener nofollow" className="news-top-row" key={story.link}>
                  <span className="mono">{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{story.title}</strong><small className="mono">{story.src} · {formatNewsDate(story.date)}</small></span>
                  <i aria-hidden>↗</i>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {stream.length > 0 && (
        <section className="news-stream wrap" aria-labelledby="news-stream-title">
          <div className="news-stream-head">
            <h2 id="news-stream-title">News stream</h2>
            <span className="mono">Titles, timestamps and direct sources</span>
          </div>
          <div className="news-stream-grid">
            {stream.map((story) => (
              <a href={story.link} target="_blank" rel="noopener nofollow" className="news-stream-story" key={story.link}>
                {story.img && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={story.img} width={110} height={82} alt="" loading="lazy" />
                )}
                <span>
                  <small className="mono">{story.src} · {formatNewsDate(story.date)}</small>
                  <strong>{story.title}</strong>
                </span>
                <i aria-hidden>↗</i>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="news-analysis wrap" aria-labelledby="analysis-title">
        <header className="news-analysis-head">
          <div>
            <p className="tool-kicker">Original analysis</p>
            <h2 id="analysis-title">What does it change?</h2>
          </div>
          <p>Our briefs start with a reported event, then test it against ratings, season simulations and the public forecast snapshot.</p>
        </header>

        <div className="news-analysis-grid">
          <div className="news-brief-list">
            {briefs.map((brief, index) => {
              const clubs = brief.clubs.map((slug) => clubBySlug(slug)).filter(Boolean);
              return (
                <Link href={`/news/${brief.slug}/`} className="news-brief-card" key={brief.slug}>
                  <span className="news-brief-index mono">Analysis {String(index + 1).padStart(2, "0")}</span>
                  {brief.img && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={brief.img} alt="" loading="lazy" />
                  )}
                  <span className="news-brief-copy">
                    <span className="news-brief-meta">
                      <span className="news-brief-crests">
                        {clubs.slice(0, 3).map((club) => club && <Crest key={club.slug} club={club.club} slug={club.slug} size="sm" />)}
                      </span>
                      <span className="mono">{brief.date} · reacting to {brief.sourceName}</span>
                    </span>
                    <strong>{brief.title}</strong>
                    <p>{briefExcerpt(brief.body)}…</p>
                    <em>Read model impact <i aria-hidden>→</i></em>
                  </span>
                </Link>
              );
            })}
          </div>

          <aside className="news-forecast-watch" aria-label="Upcoming forecast watchlist">
            <div className="news-watch-title">
              <span className="mono">Prediction watch</span>
              <Link href="/matches/">All matches ↗</Link>
            </div>
            {watchlist.map((fixture) => {
              const probability = matchProb(fixture.home.elo, fixture.away.elo);
              const max = Math.max(probability.home, probability.draw, probability.away);
              const label = max === probability.home ? fixture.home.club : max === probability.away ? fixture.away.club : "Draw";
              return (
                <Link href={`/match/${fixture.slug}/`} className="news-watch-match" key={fixture.id}>
                  <span className="mono"><b>{fixture.league.name}</b><Kickoff iso={fixture.date} /></span>
                  <strong>{fixture.home.club}<i>v</i>{fixture.away.club}</strong>
                  <span className="news-watch-model"><small>Model lean · {label}</small><b className="tnum">{(max * 100).toFixed(1)}%</b></span>
                </Link>
              );
            })}
            <p className="news-watch-note mono">These are pre-match forecasts, not live scores. Every pick locks before kickoff.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
