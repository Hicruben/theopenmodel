import Link from "next/link";
import { LEAGUES, flagUrl } from "@/lib/data";
import { fixturesOn, nextFixtureDate, upcomingFixtures } from "@/lib/fixtures";
import { matchProb, marketProbs } from "@/lib/model";
import { fairOdds, matchEditorialTags } from "@/lib/editorial";
import { pct } from "@/lib/ui";
import { Crest } from "../../components/Crest";
import { Kickoff } from "../../components/Kickoff";

export const metadata = {
  title: "Today's Football Predictions — Win Probabilities, Scores & Fair Odds",
  description:
    "Daily updated statistical football predictions for today's top-five-league matches: Elo → Dixon-Coles win probabilities, most likely scores, BTTS, Over 2.5 and fair odds.",
  alternates: { canonical: "/predictions/today/" },
};

export default function TodayPredictionsPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayMatches = fixturesOn(todayIso);
  const activeDate = todayMatches.length > 0 ? todayIso : nextFixtureDate();
  const list = todayMatches.length > 0 ? todayMatches : fixturesOn(activeDate);
  const fallbackList = list.length > 0 ? list : upcomingFixtures(15);

  const enriched = fallbackList.map((f) => {
    const p = matchProb(f.home.elo, f.away.elo);
    const mk = marketProbs(f.home.elo, f.away.elo);
    const topProb = Math.max(p.home, p.draw, p.away);
    const pick = p.home >= p.away && p.home >= p.draw ? f.home.club : p.away >= p.home && p.away >= p.draw ? f.away.club : "Draw";
    const tags = matchEditorialTags(p, mk);
    return { f, p, mk, topProb, pick, tags };
  });

  const strongest = [...enriched].sort((a, b) => b.topProb - a.topProb)[0];
  const mostGoals = [...enriched].sort((a, b) => (b.p.xgHome + b.p.xgAway) - (a.p.xgHome + a.p.xgAway))[0];
  const closest = [...enriched].sort((a, b) => Math.abs(a.p.home - a.p.away) - Math.abs(b.p.home - b.p.away))[0];

  const byLeague = LEAGUES.map((l) => ({
    league: l,
    items: enriched.filter((x) => x.f.league.slug === l.slug),
  })).filter((g) => g.items.length > 0);

  const dateLabel = new Date(`${activeDate}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="wrap" style={{ maxWidth: 1080 }}>
      <p className="crumbs">
        <Link href="/">Home</Link> › <Link href="/matches/">Matches</Link> › Today&apos;s predictions
      </p>
      <h1 className="pagetitle" style={{ marginTop: 6 }}>
        Today&apos;s football predictions
      </h1>
      <p className="pagedesc">
        {todayMatches.length > 0
          ? `All ${enriched.length} top-five-league matches kicking off today (${dateLabel}), updated daily from our open-source Elo → Dixon-Coles model.`
          : `No top-five-league matches kick off today — showing the next matchday slate (${dateLabel}, ${enriched.length} matches).`}{" "}
        <Link href="/predictions/weekend/">See weekend slate →</Link>
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "16px 0 24px" }}>
        <Link href="/predictions/weekend/" className="btn" style={{ fontSize: 12, padding: "8px 14px" }}>
          Weekend predictions →
        </Link>
        <Link href="/clearest-calls/" className="btn" style={{ fontSize: 12, padding: "8px 14px" }}>
          Top 10 clearest calls →
        </Link>
        <Link href="/tools/parlay/" className="btn" style={{ fontSize: 12, padding: "8px 14px" }}>
          Parlay reality check →
        </Link>
      </div>

      {strongest && mostGoals && closest && (
        <section className="grid cols-3" style={{ marginBottom: 28 }}>
          <Link href={`/match/${strongest.f.slug}/`} className="panel panel-link">
            <span className="eyebrow plain">Strongest lean</span>
            <strong style={{ display: "block", fontSize: 18, marginTop: 8, fontFamily: "var(--font-head)" }}>
              {strongest.f.home.club} vs {strongest.f.away.club}
            </strong>
            <div className="mono tnum" style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 6 }}>
              {strongest.pick} {pct(strongest.topProb)} · Fair {fairOdds(strongest.topProb)}
            </div>
          </Link>
          <Link href={`/match/${mostGoals.f.slug}/`} className="panel panel-link">
            <span className="eyebrow plain">Highest expected goals</span>
            <strong style={{ display: "block", fontSize: 18, marginTop: 8, fontFamily: "var(--font-head)" }}>
              {mostGoals.f.home.club} vs {mostGoals.f.away.club}
            </strong>
            <div className="mono tnum" style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 6 }}>
              {(mostGoals.p.xgHome + mostGoals.p.xgAway).toFixed(2)} xG · Over 2.5 {pct(mostGoals.mk.over25)}
            </div>
          </Link>
          <Link href={`/match/${closest.f.slug}/`} className="panel panel-link">
            <span className="eyebrow plain">Tightest matchup</span>
            <strong style={{ display: "block", fontSize: 18, marginTop: 8, fontFamily: "var(--font-head)" }}>
              {closest.f.home.club} vs {closest.f.away.club}
            </strong>
            <div className="mono tnum" style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6 }}>
              {pct(closest.p.home)} / {pct(closest.p.draw)} / {pct(closest.p.away)}
            </div>
          </Link>
        </section>
      )}

      {byLeague.map(({ league, items }) => (
        <section key={league.slug} style={{ marginBottom: 26 }}>
          <div className="lg-head">
            <h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="flag" src={flagUrl(league.flagCode, 20)} width={18} height={13} alt="" />
              {league.name}
            </h2>
            <Link href={`/league/${league.slug}/`}>Full table &amp; odds →</Link>
          </div>
          <div className="panel tight" style={{ overflowX: "auto" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Kickoff</th>
                  <th className="r">Home</th>
                  <th className="r">Draw</th>
                  <th className="r">Away</th>
                  <th className="r">Fair top</th>
                  <th>Angle</th>
                </tr>
              </thead>
              <tbody>
                {items.map(({ f, p, topProb, tags }) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/match/${f.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Crest club={f.home.club} slug={f.home.slug} size="sm" />
                        {f.home.club} <span style={{ color: "var(--muted)", fontWeight: 400 }}>v</span> {f.away.club}
                        <Crest club={f.away.club} slug={f.away.slug} size="sm" />
                      </Link>
                    </td>
                    <td className="num" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      <Kickoff iso={f.date} />
                    </td>
                    <td className="num r" style={p.home === topProb ? { color: "var(--accent)", fontWeight: 700 } : undefined}>
                      {pct(p.home)}
                    </td>
                    <td className="num r" style={p.draw === topProb ? { color: "var(--accent)", fontWeight: 700 } : undefined}>
                      {pct(p.draw)}
                    </td>
                    <td className="num r" style={p.away === topProb ? { color: "var(--accent)", fontWeight: 700 } : undefined}>
                      {pct(p.away)}
                    </td>
                    <td className="num r mono" style={{ color: "var(--ink-soft)" }}>
                      {fairOdds(topProb)}
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: 10.5, color: tags[0]?.tone === "accent" ? "var(--accent)" : tags[0]?.tone === "win" ? "var(--win)" : "var(--muted)" }}>
                        {tags[0]?.label ?? "Balanced"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
