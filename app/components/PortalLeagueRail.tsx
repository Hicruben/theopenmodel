import Link from "next/link";
import { LEAGUES, leagueClubs } from "@/lib/data";
import type { Fixture } from "@/lib/fixtures";
import { Kickoff } from "./Kickoff";

export function PortalLeagueRail({ fixtures }: { fixtures: Fixture[] }) {
  return (
    <section className="portal-section portal-leagues" aria-labelledby="portal-leagues-title">
      <header className="portal-section-header">
        <div>
          <h2 id="portal-leagues-title">Follow the biggest leagues</h2>
          <p>See upcoming matches, team strength and each club&apos;s chance of winning the season.</p>
        </div>
        <Link className="portal-section-link" href="/leagues/">
          All leagues <span aria-hidden>→</span>
        </Link>
      </header>

      <div className="portal-league-rail">
        {LEAGUES.map((league) => {
          const nextFixture = fixtures.find((fixture) => fixture.league.slug === league.slug);
          return (
            <Link className="portal-league-card" href={`/league/${league.slug}/`} key={league.slug}>
              <span className="portal-league-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/${league.slug}.jpg`}
                  width={720}
                  height={480}
                  alt={`${league.name} football`}
                  loading="lazy"
                />
              </span>
              <span className="portal-league-card-copy">
                <strong>{league.name}</strong>
                <small>{leagueClubs(league).length} clubs</small>
                {nextFixture && (
                  <span className="portal-league-next">
                    <span>{nextFixture.home.club} vs {nextFixture.away.club}</span>
                    <Kickoff iso={nextFixture.date} />
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
