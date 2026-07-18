import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAGUES, leagueBySlug, leagueClubs, flagUrl } from "@/lib/data";
import { seasonOdds } from "@/lib/season";
import { pct } from "@/lib/ui";
import { topScorers } from "@/lib/players";
import { LeagueTabs } from "../../components/LeagueTabs";
import { ForecastTable } from "../../components/ForecastTable";

export function generateStaticParams() {
  return LEAGUES.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = leagueBySlug(slug);
  if (!league) return {};
  return {
    title: `${league.name} 2026-27 forecast — title odds, top-4 & relegation probabilities`,
    description: `${league.name} 2026-27 simulated 5,000 times from current Elo: title odds, top-4 and relegation probability for every club. Open methodology, public track record.`,
  };
}

const BUILT = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = leagueBySlug(slug);
  if (!league) notFound();
  const clubs = leagueClubs(league);
  const odds = seasonOdds(league.slug, clubs);
  const favorite = odds[0];
  const second = odds[1];
  const relegants = [...odds].sort((a, b) => b.releg - a.releg).slice(0, 3);

  return (
    <main className="wrap">
      <section>
        <p className="crumbs"><Link href="/">Home</Link> › <Link href="/leagues/">Leagues</Link> › {league.name}</p>
        <h1 className="pagetitle" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="flag" src={flagUrl(league.flagCode, 40)} width={28} height={21} alt="" />
          {league.name} 2026-27 forecast
        </h1>
        <p className="pagedesc">
          {favorite.club} start as title favorites at <b>{pct(favorite.title)}</b>, ahead of{" "}
          {second.club} ({pct(second.title)}). {relegants.map((r) => r.club).join(", ")} carry the
          highest relegation risk. 5,000 simulated seasons; match-by-match picks lock onto the{" "}
          <Link href="/record/">public record</Link> from August.
        </p>
        <p className="updated" style={{ margin: "6px 0 14px" }}>
          Last updated {BUILT} · ClubElo ratings → Dixon-Coles goals → 5,000 season simulations
        </p>
        <LeagueTabs current={league.slug} />
      </section>

      <div style={{ marginTop: 18, overflowX: "auto" }}>
        <ForecastTable odds={odds} />
        <p className="foot-src">
          Cell shading ∝ probability. Trend = Elo since 2020. xPts = mean points across simulations.
          Sources: ClubElo (ratings) · The Open Model (simulation). <Link href="/methodology/">Method →</Link>
        </p>
      </div>

      {topScorers(league.slug).length > 0 && (
        <section data-reveal>
          <div className="lg-head" style={{ marginTop: 36 }}>
            <h2>Players to watch</h2>
            <span className="updated">2025-26 top scorers · API-Football</span>
          </div>
          <div className="players" style={{ marginTop: 14 }}>
            {topScorers(league.slug).slice(0, 6).map((p) => (
              <div key={p.name} className="playercard">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="face" src={p.photo} alt={p.name} loading="lazy" />
                <div className="nm">{p.name}</div>
                <div className="meta" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.teamLogo} width={13} height={13} alt="" style={{ objectFit: "contain" }} />
                  {p.team}
                </div>
                <div className="stat">{p.goals} goals · {p.assists ?? 0} assists</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 36, maxWidth: 760 }}>
        <div className="lg-head"><h2>Notes</h2></div>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "10px 0" }}>
          <b>Chance of finishing first.</b> {odds.filter((o) => o.title >= 0.05).length} clubs currently
          have at least a 5% chance of winning the league. {favorite.club} leads at {pct(favorite.title)}
          because its recent-results strength score is higher than {second.club}&apos;s. Early estimates
          can move quickly once the season starts.
        </p>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "10px 0" }}>
          <b>Other important places.</b> The closest races to finish in the top four:{" "}
          {odds.filter((o) => o.top4 > 0.15 && o.top4 < 0.6).map((o) => o.club).slice(0, 3).join(", ")}.
          Clubs with an uncertain chance of dropping to a lower division:{" "}
          {odds.filter((o) => o.releg > 0.2 && o.releg < 0.6).map((o) => o.club).slice(0, 3).join(", ")}.
        </p>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "10px 0" }}>
          <b>From August.</b> This page will add a home-win, draw and away-win percentage before each
          match. The club model will build its own results history. The project&apos;s separate World Cup
          model already has a <Link href="/record/">public past-results page</Link>.
        </p>
      </section>
    </main>
  );
}
