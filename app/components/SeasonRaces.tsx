import Link from "next/link";
import { LEAGUES, leagueClubs } from "@/lib/data";
import { seasonOdds } from "@/lib/season";
import { topMovers } from "@/lib/movement";
import { pct } from "@/lib/ui";

// The site's answer to "how does my club's season end" belongs above the fold, not three
// levels down. Two things go here: where each race stands, and what moved this week —
// the second is what makes it worth looking again rather than once.

const pp = (d: number) => `${d > 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)}pp`;

export function SeasonRaces() {
  const movers = topMovers(6);

  const races = LEAGUES.map((league) => {
    const odds = seasonOdds(league.slug, leagueClubs(league));
    const byTitle = [...odds].sort((a, b) => b.title - a.title);
    const byReleg = [...odds].sort((a, b) => b.releg - a.releg);
    return { league, favourite: byTitle[0], challenger: byTitle[1], atRisk: byReleg[0] };
  });

  return (
    <section className="races wrap" aria-labelledby="races-h">
      <div className="races-head">
        <h2 id="races-h">Where the season is heading</h2>
        <p>
          Every club in the top five leagues, simulated 5,000 times a day. Pick a league to see
          the full projected table, or a club to see its own season.
        </p>
      </div>

      {/* The match-level calibration published on /record/ says nothing about these
          numbers: a season projection is a different claim, and it has never been scored.
          Saying so matters most where the model sounds most certain — a newly promoted
          side carries a second-division rating into August, which is exactly when it will
          look most confident and be least tested. */}
      <p className="races-caveat">
        These are season-long simulations, and unlike the match forecasts they have{" "}
        <b>not been backtested</b> — treat the confident ones with particular suspicion,
        especially for promoted clubs, whose ratings still come from the division they just
        left.
      </p>

      <div className="races-grid">
        {races.map(({ league, favourite, challenger, atRisk }) => (
          <div className="race-card" key={league.slug}>
            <Link href={`/league/${league.slug}/table/`} className="race-league">
              <span aria-hidden>{league.flag}</span> {league.name}
            </Link>
            <dl className="race-rows">
              <div>
                <dt>Favourite</dt>
                <dd>
                  <Link href={`/team/${favourite.slug}/`}>{favourite.club}</Link>
                  <b className="tnum">{pct(favourite.title)}</b>
                </dd>
              </div>
              {challenger && (
                <div>
                  <dt>Nearest rival</dt>
                  <dd>
                    <Link href={`/team/${challenger.slug}/`}>{challenger.club}</Link>
                    <b className="tnum">{pct(challenger.title)}</b>
                  </dd>
                </div>
              )}
              <div>
                <dt>Most at risk</dt>
                <dd>
                  <Link href={`/team/${atRisk.slug}/`}>{atRisk.club}</Link>
                  <b className="tnum down">{pct(atRisk.releg)}</b>
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {movers.length > 0 && (
        <div className="movers">
          <h3>What moved this week</h3>
          <ul>
            {movers.map((m) => (
              <li key={`${m.slug}-${m.metric}`}>
                <Link href={`/team/${m.slug}/`}>{m.club}</Link>
                <span className="movers-what">{m.label}</span>
                <span className="tnum movers-from">{pct(m.then)} → <b>{pct(m.now)}</b></span>
                <span className={`tnum ${m.good ? "outlook-up" : "outlook-down"}`}>
                  {m.delta > 0 ? "▲" : "▼"} {pp(m.delta)}
                </span>
              </li>
            ))}
          </ul>
          <p className="movers-foot">
            Probabilities move when results come in — these are the biggest shifts in the last
            week. Every match behind them was{" "}
            <Link href="/record/">predicted before kickoff and scored afterwards</Link>.
          </p>
        </div>
      )}
    </section>
  );
}
