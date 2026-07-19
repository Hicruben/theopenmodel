import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAGUES, leagueBySlug, leagueClubs, flagUrl } from "@/lib/data";
import { seasonOdds } from "@/lib/season";
import { pct } from "@/lib/ui";
import { LeagueTabs } from "../../../components/LeagueTabs";
import { LeagueSubnav } from "../../../components/LeagueSubnav";
import { Crest } from "../../../components/Crest";

export function generateStaticParams() {
  return LEAGUES.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = leagueBySlug(slug);
  if (!league) return {};
  return {
    title: `${league.name} table 2026-27 — predicted final standings`,
    description: `${league.name} 2026-27 predicted final table: projected points, finishing position and title / top-4 / relegation probability for every club, from 5,000 season simulations. Switches to the live table once the season starts.`,
  };
}

const BUILT = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Ordinal helper (1 → 1st).
const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default async function LeagueTablePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = leagueBySlug(slug);
  if (!league) notFound();
  const clubs = leagueClubs(league);
  const odds = seasonOdds(league.slug, clubs);
  const n = odds.length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${league.name} 2026-27 predicted final table`,
    numberOfItems: n,
    itemListElement: odds.map((o, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: o.club,
      url: `https://theopenmodel.com/team/${o.slug}/`,
    })),
  };

  // Zones: top club(s) = title race, top 4 = Champions League, 5-6 = Europe, bottom 3 = relegation.
  const zone = (i: number): { cls: string; label: string } | null => {
    if (i < 4) return { cls: "cl", label: "Champions League places" };
    if (i < 6) return { cls: "el", label: "European places" };
    if (i >= n - 3) return { cls: "rel", label: "Relegation zone" };
    return null;
  };

  return (
    <main className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section>
        <p className="crumbs">
          <Link href="/">Home</Link> › <Link href="/leagues/">Leagues</Link> ›{" "}
          <Link href={`/league/${league.slug}/`}>{league.name}</Link> › Table
        </p>
        <h1 className="pagetitle" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="flag" src={flagUrl(league.flagCode, 40)} width={28} height={21} alt="" />
          {league.name} table 2026-27
        </h1>
        <p className="pagedesc">
          The predicted final table — where each club is most likely to finish, from 5,000 simulated
          seasons. Projected points are the average across every simulation; the range shows the
          10th-to-90th percentile. Once the season kicks off in August this page shows the live
          standings alongside the projection.
        </p>
        <p className="updated" style={{ margin: "6px 0 14px" }}>
          Predicted table · updated {BUILT} · ClubElo ratings → Dixon-Coles → 5,000 simulations
        </p>
        <LeagueTabs current={league.slug} />
        <LeagueSubnav slug={league.slug} current="table" />
      </section>

      <div style={{ marginTop: 18, overflowX: "auto" }}>
        <table className="data leaguetable">
          <thead>
            <tr>
              <th style={{ width: 34 }} className="c">#</th>
              <th>Club</th>
              <th className="c" title="Projected final points (average across 5,000 simulations)">Proj. Pts</th>
              <th className="c hide-m" title="10th–90th percentile points range">Range</th>
              <th className="c" title="Probability of winning the league">Title</th>
              <th className="c hide-m" title="Probability of a top-4 finish">Top 4</th>
              <th className="c" title="Probability of relegation">Rel.</th>
            </tr>
          </thead>
          <tbody>
            {odds.map((o, i) => {
              const z = zone(i);
              return (
                <tr key={o.slug} className={z ? `zone-${z.cls}` : undefined}>
                  <td className="c num" style={{ position: "relative" }}>
                    {z && <span className="zone-bar" title={z.label} aria-label={z.label} />}
                    {i + 1}
                  </td>
                  <td>
                    <Link href={`/team/${o.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                      <Crest club={o.club} slug={o.slug} size="sm" />{o.club}
                    </Link>
                  </td>
                  <td className="c num"><b>{o.avgPts.toFixed(0)}</b></td>
                  <td className="c num hide-m" style={{ color: "var(--muted)" }}>{o.ptsLo}–{o.ptsHi}</td>
                  <td className="c num" style={o.title >= 0.01 ? { color: "var(--accent-ink)", fontWeight: 600 } : { color: "var(--faint)" }}>{pct(o.title)}</td>
                  <td className="c num hide-m">{pct(o.top4)}</td>
                  <td className="c num" style={o.releg >= 0.01 ? { color: "var(--loss)" } : { color: "var(--faint)" }}>{pct(o.releg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="tablekey" style={{ marginTop: 14 }}>
        <span className="k"><span className="sw cl" /> Champions League (top 4)</span>
        <span className="k"><span className="sw el" /> European places (5–6)</span>
        <span className="k"><span className="sw rel" /> Relegation (bottom 3)</span>
      </div>
      <p className="foot-src" style={{ marginTop: 10 }}>
        Projected points are means over 5,000 Monte Carlo seasons from current ClubElo ratings; a club
        can finish well outside this order in any single season. This is a forecast, not a result —
        see the <Link href="/record/">public track record</Link> and{" "}
        <Link href="/methodology/">methodology</Link>. Data reusable under{" "}
        <Link href="/data/">CC BY 4.0</Link>.
      </p>
    </main>
  );
}
