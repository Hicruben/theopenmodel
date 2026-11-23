import Link from "next/link";
import { LEAGUES } from "@/lib/data";
import { upcomingFixtures } from "@/lib/fixtures";
import { matchProb } from "@/lib/model";
import { clubRecord } from "@/lib/record";
import { MatchExplorer, type MatchExplorerMatch } from "./components/MatchExplorer";
import { TodayPortal } from "./components/TodayPortal";
import { LiveTicker } from "./components/LiveTicker";
import { CountUp } from "./components/CountUp";
import { NewsletterSignup } from "./components/NewsletterSignup";
import { SeasonRaces } from "./components/SeasonRaces";

function explainFixture(home: string, homeElo: number, away: string, awayElo: number) {
  const gap = Math.round(Math.abs(homeElo - awayElo));
  if (gap < 30) {
    return `${home} and ${away} have performed at a similar level. Playing at home gives ${home} a small advantage.`;
  }
  if (homeElo > awayElo) {
    return `${home} has produced stronger results and is also playing at home.`;
  }
  return `${away} has produced stronger results, even after allowing for ${home} playing at home.`;
}

export default function Home() {
  const fixturePool = upcomingFixtures(180);
  const rec = clubRecord();
  const hasLiveClubRecord = rec.n >= 20;
  const challengeFixtures = LEAGUES
    .map((league) => fixturePool.find((fixture) => fixture.league.slug === league.slug))
    .filter((fixture): fixture is NonNullable<typeof fixture> => Boolean(fixture))
    .slice(0, 4);

  const explorerMatches: MatchExplorerMatch[] = challengeFixtures.map((fixture) => ({
    slug: fixture.slug,
    date: fixture.date,
    league: fixture.league.name,
    home: fixture.home.club,
    homeLogo: fixture.home.logo,
    away: fixture.away.club,
    awayLogo: fixture.away.logo,
    probabilities: matchProb(fixture.home.elo, fixture.away.elo),
    explanation: explainFixture(fixture.home.club, fixture.home.elo, fixture.away.club, fixture.away.elo),
  }));

  const predictionLab = (
    <div className="portal-section portal-prediction-lab" id="live" data-reveal>
      <div className="portal-prediction-marker">
        <p>Compare your pick with the model before opening the full forecast.</p>
        <Link href="/guide/">How the model works <b aria-hidden>→</b></Link>
      </div>
      <MatchExplorer matches={explorerMatches} />
    </div>
  );

  return (
    <main className="home-page portal-page portal-page-home">
      <TodayPortal predictionSlot={predictionLab} tickerSlot={<LiveTicker fixtures={fixturePool.slice(0, 12)} />} />

      <SeasonRaces />

      <section className="record-stage" data-reveal>
        <div className="record-grid wrap">
          <div className="record-copy">
            <h2>Every forecast stays on the record.</h2>
            <p>
              {hasLiveClubRecord
                ? `In the live 2026–27 European club season, the model's pre-kickoff top outcome has matched ${rec.hits} of ${rec.n} completed matches (${(rec.accuracy * 100).toFixed(1)}%) — following 70 of 102 in the 2026 World Cup. Every call is locked before kickoff.`
                : "The model's top outcome matched the final result in 70 of 102 completed World Cup matches through 15 July 2026. Every call was published before kickoff."}
            </p>
            <div className="record-actions">
              <Link href="/record/" className="signal-button">View the public record <span aria-hidden>→</span></Link>
              <Link href="/predictions/today/" className="text-action">Today&apos;s predictions <span aria-hidden>→</span></Link>
              <Link href="/predictions/weekend/" className="text-action">Weekend slate <span aria-hidden>→</span></Link>
            </div>
          </div>
          <dl className="record-facts">
            <div>
              <dt>{hasLiveClubRecord ? "2026–27 club season matched" : "Top outcome matched"}</dt>
              <dd>
                <strong className="tnum">
                  <CountUp end={hasLiveClubRecord ? rec.hits : 70} duration={1000} /> of {hasLiveClubRecord ? rec.n : 102}
                </strong>
                <span>{hasLiveClubRecord ? "locked pre-kickoff matches" : "completed matches"}</span>
              </dd>
            </div>
            <div>
              <dt>How misses are counted</dt>
              <dd><span>A draw counts as a miss when a team was the top pick.</span></dd>
            </div>
          </dl>
        </div>
        <p className="record-note wrap">Forecast published before kickoff. Final result checked. Correct and incorrect calls kept.</p>
      </section>

      <section className="wrap" style={{ margin: "36px auto 8px" }}>
        <NewsletterSignup source="home" />
      </section>
    </main>
  );
}
