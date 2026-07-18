import Link from "next/link";
import type { Fixture } from "@/lib/fixtures";
import { matchProb } from "@/lib/model";
import { Crest } from "./Crest";
import { Kickoff } from "./Kickoff";

function roundLabel(round: string) {
  return round.replace("Regular Season - ", "Matchday ");
}

function probabilityClass(value: number, leader: number) {
  return value === leader ? "portal-match-probability is-leading" : "portal-match-probability";
}

export function PortalMatchday({
  fixtures,
  title,
  description,
}: {
  fixtures: Fixture[];
  title: string;
  description: string;
}) {
  return (
    <section className="portal-section portal-matchday" data-reveal id="upcoming-predictions" aria-labelledby="portal-matchday-title">
      <header className="portal-section-header">
        <div>
          <h2 id="portal-matchday-title">{title}</h2>
          <p>{description}</p>
        </div>
        <Link className="portal-section-link" href="/matches/">
          See all predictions <span aria-hidden>→</span>
        </Link>
      </header>

      <aside className="portal-probability-guide" aria-label="How to read the prediction percentages">
        <div>
          <span className="portal-probability-guide-number">60%</span>
          <p>means the model expects that result about 6 times in 10 similar matches.</p>
        </div>
        <div>
          <span>All three results</span>
          <p>Home-team win, draw and away-team win always add up to 100%.</p>
        </div>
        <div>
          <span>Most likely ≠ certain</span>
          <p>The highest percentage is our best estimate, not a promise.</p>
        </div>
        <Link href="/guide/">Read the simple guide <span aria-hidden>→</span></Link>
      </aside>

      {fixtures.length > 0 ? (
        <ol className="portal-match-list">
          {fixtures.map((fixture) => {
            const probability = matchProb(fixture.home.elo, fixture.away.elo);
            const leader = Math.max(probability.home, probability.draw, probability.away);

            return (
              <li key={fixture.id}>
                <Link className="portal-match-row" href={`/match/${fixture.slug}/`}>
                  <article>
                    <div className="portal-match-meta">
                      <span>{fixture.league.name}</span>
                      <span>{roundLabel(fixture.round)}</span>
                      <Kickoff iso={fixture.date} style="time" />
                    </div>

                    <div className="portal-match-teams">
                      <span className="portal-match-team">
                        <Crest club={fixture.home.club} slug={fixture.home.slug} />
                        <strong>{fixture.home.club}</strong>
                      </span>
                      <span className="portal-match-versus">vs</span>
                      <span className="portal-match-team is-away">
                        <Crest club={fixture.away.club} slug={fixture.away.slug} />
                        <strong>{fixture.away.club}</strong>
                      </span>
                    </div>

                    <dl className="portal-match-probabilities" aria-label={`Estimated chances: ${fixture.home.club} win, draw, or ${fixture.away.club} win`}>
                      <div className={probabilityClass(probability.home, leader)}>
                        <dt title={`${fixture.home.club} wins`}>{fixture.home.club}</dt>
                        <dd>{(probability.home * 100).toFixed(1)}%</dd>
                      </div>
                      <div className={probabilityClass(probability.draw, leader)}>
                        <dt title="Draw: neither team wins">Draw</dt>
                        <dd>{(probability.draw * 100).toFixed(1)}%</dd>
                      </div>
                      <div className={probabilityClass(probability.away, leader)}>
                        <dt title={`${fixture.away.club} wins`}>{fixture.away.club}</dt>
                        <dd>{(probability.away * 100).toFixed(1)}%</dd>
                      </div>
                    </dl>

                    <span className="portal-match-open" aria-hidden>See why →</span>
                  </article>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="portal-empty-state">
          <h3>No matches are scheduled yet</h3>
          <p>We&apos;ll add them as soon as official league schedules are available.</p>
          <Link href="/leagues/">Explore the leagues</Link>
        </div>
      )}
    </section>
  );
}
