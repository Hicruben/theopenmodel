import Link from "next/link";
import { CountUp } from "./CountUp";
import type { ReactNode } from "react";
import { allClubs, LEAGUES } from "@/lib/data";
import { upcomingFixtures } from "@/lib/fixtures";
import { matchProb } from "@/lib/model";
import { latestNews, newsUpdatedAt } from "@/lib/news";
import { topScorers } from "@/lib/players";
import { portalSnapshot } from "@/lib/portal";
import { Crest } from "./Crest";
import { Kickoff } from "./Kickoff";
import { PortalLeagueRail } from "./PortalLeagueRail";
import { PortalLiveFeed } from "./PortalLiveFeed";
import { PortalMatchday } from "./PortalMatchday";
import { PortalLeadStory, PortalNewsCards, PortalNewsFeed, PortalNewsUpdated } from "./PortalNewsFeed";

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function TodayPortal({ predictionSlot, tickerSlot }: { predictionSlot?: ReactNode; tickerSlot?: ReactNode } = {}) {
  const portal = portalSnapshot();
  const providerReady = portal.provider === "api-football";
  const initialLiveFixtures = providerReady
    ? portal.fixtures.map((fixture) => ({
        ...fixture,
        scores: [],
        events: [],
        lineups: [],
        injuries: [],
      }))
    : [];
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);

  const fixturePool = upcomingFixtures(120);
  const nextFixture = fixturePool[0];
  const nextProbability = nextFixture
    ? matchProb(nextFixture.home.elo, nextFixture.away.elo)
    : null;
  const todayFixtures = fixturePool.filter((fixture) => fixture.date.slice(0, 10) === todayKey);
  const nextDate = fixturePool[0]?.date.slice(0, 10);
  const nextDateFixtures = nextDate
    ? fixturePool.filter((fixture) => fixture.date.slice(0, 10) === nextDate)
    : [];
  const matchdayFixtures = (todayFixtures.length > 0 ? todayFixtures : nextDateFixtures).slice(0, 8);
  const matchdayTitle = todayFixtures.length > 0 ? "Today's matches and predictions" : "Next matches and predictions";
  const matchdayDescription = todayFixtures.length > 0
    ? `${todayFixtures.length} confirmed matches. Choose one to see the estimated chance of each result.`
    : nextDate
      ? `${dateLabel(`${nextDate}T12:00:00Z`)}. Choose a match to see the estimated chance of each result.`
      : "Matches will appear here as soon as official schedules are available.";

  const analysedFixtures = fixturePool.slice(0, 80).map((fixture) => {
    const probability = matchProb(fixture.home.elo, fixture.away.elo);
    const outcomes = [
      { label: fixture.home.club, value: probability.home },
      { label: "Draw", value: probability.draw },
      { label: fixture.away.club, value: probability.away },
    ].sort((a, b) => b.value - a.value);
    const winPick = probability.home >= probability.away ? fixture.home : fixture.away;
    return {
      fixture,
      probability,
      leader: outcomes[0],
      runnerUp: outcomes[1],
      margin: outcomes[0].value - outcomes[1].value,
      winPick,
      winLean: Math.max(probability.home, probability.away),
      totalXg: probability.xgHome + probability.xgAway,
    };
  });
  const strongest = [...analysedFixtures].sort((a, b) => b.winLean - a.winLean)[0];
  const closest = [...analysedFixtures].sort((a, b) => a.margin - b.margin)[0];
  const goalsWatch = [...analysedFixtures].sort((a, b) => b.totalXg - a.totalXg)[0];

  const stories = latestNews(18);
  const updated = newsUpdatedAt();

  const clubsByApiId = new Map(allClubs().map((club) => [club.apiId, club]));
  const players = LEAGUES.flatMap((league) =>
    topScorers(league.slug).slice(0, 1).map((player) => ({
      ...player,
      league,
      club: clubsByApiId.get(player.teamId),
    }))
  );

  const tools = [
    { href: "/tools/scenario/", title: "What-if season simulator", copy: "Change a result and see how the league table could move." },
    { href: "/best-bets/", title: "Top predictions", copy: "See the upcoming matches where one result stands out most." },
    { href: "/movers/", title: "Teams improving fastest", copy: "See which clubs have become stronger or weaker over time." },
    { href: "/data/", title: "Download the data", copy: "Take every prediction with you as a CSV or JSON file." },
  ];

  return (
    <PortalNewsFeed initialStories={stories} initialUpdated={updated}>
      <header className="portal-masthead wrap">
        <div className="portal-date-block">
          <p>Today in football</p>
          <time dateTime={todayKey}>{todayLabel}</time>
        </div>
        <div className="portal-status-block">
          <Link className="portal-record-chip" href="/record/">
            Model record <b className="tnum">70/102</b> checked
          </Link>
          <span>{providerReady
            ? portal.coverage.liveFixtureCount > 0
              ? `${portal.coverage.liveFixtureCount} matches live now`
              : "No matches live right now"
            : "Match times and predictions available"}</span>
          <PortalNewsUpdated />
        </div>
      </header>

      {tickerSlot}

      <section className="portal-hero wrap" aria-labelledby="portal-title">
        <aside className="portal-hero-briefing" aria-labelledby="portal-title">
          <header className="portal-briefing-intro">
            <h1 id="portal-title">Football today</h1>
            <p>News, fixtures and clear forecasts for the games ahead.</p>
          </header>

          {nextFixture && nextProbability && (
            <Link className="portal-next-forecast" href={`/match/${nextFixture.slug}/`}>
              <span className="portal-next-forecast-label">Next forecast</span>
              <strong>{nextFixture.home.club} vs {nextFixture.away.club}</strong>
              <span className="portal-next-forecast-meta">
                <Kickoff iso={nextFixture.date} />
                <small>Published before kickoff</small>
              </span>
              <dl>
                <div><dt>{nextFixture.home.club}</dt><dd>{Math.round(nextProbability.home * 100)}%</dd></div>
                <div><dt>Draw</dt><dd>{Math.round(nextProbability.draw * 100)}%</dd></div>
                <div><dt>{nextFixture.away.club}</dt><dd>{Math.round(nextProbability.away * 100)}%</dd></div>
              </dl>
            </Link>
          )}

          <nav className="portal-briefing-links" aria-label="Explore football">
            <Link href="/matches/">All predictions <span aria-hidden>→</span></Link>
            <Link href="/leagues/">Leagues <span aria-hidden>→</span></Link>
            <Link href="/news/">Football news <span aria-hidden>→</span></Link>
            <Link href="/tools/">Tools <span aria-hidden>→</span></Link>
          </nav>
        </aside>

        <PortalLeadStory />
      </section>

      <div className="portal-content wrap">
        <PortalLiveFeed
          initialFixtures={initialLiveFixtures}
          initialAsOf={providerReady ? portal.asOf : null}
        />

        <PortalMatchday
          fixtures={matchdayFixtures}
          title={matchdayTitle}
          description={matchdayDescription}
        />

        <section className="portal-section portal-radar" data-reveal aria-labelledby="portal-radar-title">
          <header className="portal-section-header">
            <div>
              <h2 id="portal-radar-title">Three forecasts to watch</h2>
              <p>One clear favourite, one close call and one match with a higher goal estimate.</p>
            </div>
            <Link className="portal-section-link" href="/best-bets/">
              See all predictions <span aria-hidden>→</span>
            </Link>
          </header>

          <div className="portal-forecast-watch">
            {strongest && (
              <Link className="portal-forecast-lead" href={`/match/${strongest.fixture.slug}/`}>
                <span className="portal-forecast-label">Clear favourite</span>
                <span className="portal-forecast-team">
                  <Crest club={strongest.winPick.club} slug={strongest.winPick.slug} size="xl" />
                  <strong>{strongest.winPick.club}</strong>
                </span>
                <b><CountUp end={Math.round(strongest.winLean * 100)} suffix="%" duration={900} /></b>
                <span className="portal-forecast-meta">
                  <span>{strongest.fixture.league.name}</span>
                  <Kickoff iso={strongest.fixture.date} />
                </span>
                <small>Estimated chance of beating {strongest.winPick.slug === strongest.fixture.home.slug ? strongest.fixture.away.club : strongest.fixture.home.club}.</small>
              </Link>
            )}
            <div className="portal-forecast-briefs">
              {closest && (
                <Link href={`/match/${closest.fixture.slug}/`}>
                  <span className="portal-forecast-label">Closest call</span>
                  <strong>{closest.fixture.home.club} vs {closest.fixture.away.club}</strong>
                  <b>{Math.round(closest.leader.value * 100)}% and {Math.round(closest.runnerUp.value * 100)}%</b>
                  <small>The two leading outcomes are {closest.leader.label} and {closest.runnerUp.label}.</small>
                </Link>
              )}
              {goalsWatch && (
                <Link href={`/match/${goalsWatch.fixture.slug}/`}>
                  <span className="portal-forecast-label">Goals watch</span>
                  <strong>{goalsWatch.fixture.home.club} vs {goalsWatch.fixture.away.club}</strong>
                  <b>{goalsWatch.totalXg.toFixed(1)} expected goals</b>
                  <small>The highest combined goal estimate among the next matches.</small>
                </Link>
              )}
            </div>
          </div>
        </section>

        {predictionSlot}

        <PortalLeagueRail fixtures={fixturePool} />

        <section className="portal-section portal-players" data-reveal aria-labelledby="portal-players-title">
          <header className="portal-section-header">
            <div>
              <h2 id="portal-players-title">Players to know</h2>
              <p>The player who scored the most goals last season in each league we cover.</p>
            </div>
          </header>
          <div className="portal-player-grid">
            {players.map((player) => {
              const content = (
                <article className="portal-player-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={player.photo} width={180} height={180} alt={`${player.name}, ${player.team}`} loading="lazy" />
                  <span className="portal-player-copy">
                    <small>{player.league.name}</small>
                    <strong>{player.name}</strong>
                    <span>{player.team}</span>
                    <dl>
                      <div><dt>Goals</dt><dd>{player.goals}</dd></div>
                      <div><dt>Goals set up</dt><dd>{player.assists}</dd></div>
                      <div><dt>Matches</dt><dd>{player.apps}</dd></div>
                    </dl>
                  </span>
                </article>
              );
              return player.club ? (
                <Link href={`/team/${player.club.slug}/`} key={player.name} className="portal-player-link">
                  {content}
                </Link>
              ) : (
                <div key={player.name} className="portal-player-link">{content}</div>
              );
            })}
          </div>
        </section>

        <section className="portal-section portal-news" data-reveal aria-labelledby="portal-news-title">
          <header className="portal-section-header">
            <div>
              <h2 id="portal-news-title">More football news</h2>
              <p>Reporting from trusted publishers, kept separate from our model&apos;s analysis.</p>
            </div>
            <Link className="portal-section-link" href="/news/">
              See all football news <span aria-hidden>→</span>
            </Link>
          </header>
          <PortalNewsCards />
        </section>

        <section className="portal-section portal-toolkit" data-reveal aria-labelledby="portal-toolkit-title">
          <header className="portal-section-header">
            <div>
              <h2 id="portal-toolkit-title">Football tools</h2>
              <p>Try different results, compare teams and explore the numbers behind each prediction.</p>
            </div>
            <Link className="portal-section-link" href="/tools/">
              All tools <span aria-hidden>→</span>
            </Link>
          </header>
          <div className="portal-tool-grid">
            {tools.map((tool) => (
              <Link href={tool.href} className="portal-tool-link" key={tool.href}>
                <strong>{tool.title}</strong>
                <span>{tool.copy}</span>
                <i aria-hidden>→</i>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PortalNewsFeed>
  );
}
