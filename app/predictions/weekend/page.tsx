import Link from "next/link";
import { LEAGUES, flagUrl } from "@/lib/data";
import { upcomingFixtures } from "@/lib/fixtures";
import { matchProb, marketProbs } from "@/lib/model";
import { fairOdds, matchEditorialTags } from "@/lib/editorial";
import { pct } from "@/lib/ui";
import { Crest } from "../../components/Crest";
import { Kickoff } from "../../components/Kickoff";

export const metadata = {
  title: "Weekend Football Predictions — Saturday & Sunday Win % and Fair Odds",
  description:
    "Full weekend football predictions across the Premier League, La Liga, Serie A, Bundesliga and Ligue 1. Model win probabilities, upset watch, Over 2.5 goals and break-even fair odds.",
  alternates: { canonical: "/predictions/weekend/" },
};

function isWeekendDay(iso: string): boolean {
  const day = new Date(iso).getUTCDay(); // 5=Fri, 6=Sat, 0=Sun
  return day === 5 || day === 6 || day === 0;
}

export default function WeekendPredictionsPage() {
  const pool = upcomingFixtures(120);
  // Find the first upcoming Friday/Saturday/Sunday block (within 4 days of the first weekend match)
  const firstWeekend = pool.find((f) => isWeekendDay(f.date));
  const anchorTs = firstWeekend ? new Date(firstWeekend.date).getTime() : Date.now();
  const slate = firstWeekend
    ? pool.filter((f) => {
        const dt = new Date(f.date).getTime() - anchorTs;
        return dt >= -12 * 3600_000 && dt <= 78 * 3600_000 && isWeekendDay(f.date);
      })
    : pool.slice(0, 25);

  const enriched = slate.map((f) => {
    const p = matchProb(f.home.elo, f.away.elo);
    const mk = marketProbs(f.home.elo, f.away.elo);
    const topProb = Math.max(p.home, p.draw, p.away);
    const pick = p.home >= p.away && p.home >= p.draw ? f.home.club : p.away >= p.home && p.away >= p.draw ? f.away.club : "Draw";
    const tags = matchEditorialTags(p, mk);
    return { f, p, mk, topProb, pick, tags };
  });

  const topFavourites = [...enriched].sort((a, b) => b.topProb - a.topProb).slice(0, 5);
  const upsetCandidate =
    [...enriched]
      .filter((x) => Math.min(x.p.home, x.p.away) >= 0.25)
      .sort((a, b) => Math.abs(a.p.home - a.p.away) - Math.abs(b.p.home - b.p.away))[0] ?? enriched[0];
  const goalFest = [...enriched].sort((a, b) => (b.p.xgHome + b.p.xgAway) - (a.p.xgHome + a.p.xgAway))[0];

  const byLeague = LEAGUES.map((l) => ({
    league: l,
    items: enriched.filter((x) => x.f.league.slug === l.slug),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="wrap" style={{ maxWidth: 1080 }}>
      <p className="crumbs">
        <Link href="/">Home</Link> › <Link href="/matches/">Matches</Link> › Weekend predictions
      </p>
      <h1 className="pagetitle" style={{ marginTop: 6 }}>
        Weekend football predictions
      </h1>
      <p className="pagedesc">
        Every Friday–Sunday top-five-league fixture ({enriched.length} matches) with Elo → Dixon-Coles win probabilities,
        break-even fair odds, and automated match angles. Rebuilt every morning.{" "}
        <Link href="/predictions/today/">See today&apos;s slate →</Link>
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "16px 0 24px" }}>
        <Link href="/predictions/today/" className="btn" style={{ fontSize: 12, padding: "8px 14px" }}>
          Today&apos;s predictions →
        </Link>
        <Link href="/tools/parlay/" className="btn" style={{ fontSize: 12, padding: "8px 14px" }}>
          Build a weekend parlay →
        </Link>
        <Link href="/record/" className="btn" style={{ fontSize: 12, padding: "8px 14px" }}>
          Public track record →
        </Link>
      </div>

      {topFavourites[0] && upsetCandidate && goalFest && (
        <section className="grid cols-3" style={{ marginBottom: 28 }}>
          <Link href={`/match/${topFavourites[0].f.slug}/`} className="panel panel-link">
            <span className="eyebrow plain">Weekend banker</span>
            <strong style={{ display: "block", fontSize: 18, marginTop: 8, fontFamily: "var(--font-head)" }}>
              {topFavourites[0].f.home.club} vs {topFavourites[0].f.away.club}
            </strong>
            <div className="mono tnum" style={{ fontSize: 12.5, color: "var(--win)", marginTop: 6 }}>
              {topFavourites[0].pick} {pct(topFavourites[0].topProb)} · Fair {fairOdds(topFavourites[0].topProb)}
            </div>
          </Link>
          <Link href={`/match/${upsetCandidate.f.slug}/`} className="panel panel-link">
            <span className="eyebrow plain">Upset watch</span>
            <strong style={{ display: "block", fontSize: 18, marginTop: 8, fontFamily: "var(--font-head)" }}>
              {upsetCandidate.f.home.club} vs {upsetCandidate.f.away.club}
            </strong>
            <div className="mono tnum" style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 6 }}>
              {pct(upsetCandidate.p.home)} / {pct(upsetCandidate.p.draw)} / {pct(upsetCandidate.p.away)}
            </div>
          </Link>
          <Link href={`/match/${goalFest.f.slug}/`} className="panel panel-link">
            <span className="eyebrow plain">Highest expected goals</span>
            <strong style={{ display: "block", fontSize: 18, marginTop: 8, fontFamily: "var(--font-head)" }}>
              {goalFest.f.home.club} vs {goalFest.f.away.club}
            </strong>
            <div className="mono tnum" style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 6 }}>
              {(goalFest.p.xgHome + goalFest.p.xgAway).toFixed(2)} xG · Over 2.5 {pct(goalFest.mk.over25)}
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
