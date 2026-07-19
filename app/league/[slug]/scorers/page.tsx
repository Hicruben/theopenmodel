import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAGUES, leagueBySlug, flagUrl, allClubs } from "@/lib/data";
import { topScorers } from "@/lib/players";
import { LeagueTabs } from "../../../components/LeagueTabs";
import { LeagueSubnav } from "../../../components/LeagueSubnav";

export function generateStaticParams() {
  return LEAGUES.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = leagueBySlug(slug);
  if (!league) return {};
  const top = topScorers(slug)[0];
  return {
    title: `${league.name} top scorers 2025-26 — goals & assists leaderboard`,
    description: top
      ? `${league.name} top scorers: ${top.name} led with ${top.goals} goals. Full goals and assists leaderboard for the latest completed season.`
      : `${league.name} goals and assists leaderboard.`,
  };
}

export default async function LeagueScorersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = leagueBySlug(slug);
  if (!league) notFound();
  const scorers = topScorers(slug).slice(0, 25);
  const clubsByApiId = new Map(allClubs().map((c) => [c.apiId, c]));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${league.name} top scorers 2025-26`,
    numberOfItems: scorers.length,
    itemListElement: scorers.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
    })),
  };

  return (
    <main className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section>
        <p className="crumbs">
          <Link href="/">Home</Link> › <Link href="/leagues/">Leagues</Link> ›{" "}
          <Link href={`/league/${league.slug}/`}>{league.name}</Link> › Top scorers
        </p>
        <h1 className="pagetitle" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="flag" src={flagUrl(league.flagCode, 40)} width={28} height={21} alt="" />
          {league.name} top scorers
        </h1>
        <p className="pagedesc">
          The goals and assists leaderboard for the latest completed {league.name} season. New-season
          numbers replace these once matchday one has been played.
        </p>
        <LeagueTabs current={league.slug} />
        <LeagueSubnav slug={league.slug} current="scorers" />
      </section>

      {scorers.length === 0 ? (
        <p className="pagedesc" style={{ marginTop: 20 }}>Scorer data for this league isn&apos;t available yet.</p>
      ) : (
        <div style={{ marginTop: 18, overflowX: "auto" }}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 34 }} className="c">#</th>
                <th>Player</th>
                <th className="hide-m">Club</th>
                <th className="c" title="Goals">G</th>
                <th className="c" title="Assists">A</th>
                <th className="c hide-m" title="Appearances">Apps</th>
                <th className="c hide-m" title="Goals + assists per appearance">G+A / app</th>
              </tr>
            </thead>
            <tbody>
              {scorers.map((s, i) => {
                const club = clubsByApiId.get(s.teamId);
                const perApp = s.apps > 0 ? ((s.goals + s.assists) / s.apps).toFixed(2) : "—";
                return (
                  <tr key={`${s.name}-${i}`}>
                    <td className="c num">{i + 1}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.photo} alt="" width={30} height={30} loading="lazy"
                          style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", background: "var(--panel-2)", border: "1px solid var(--rule)" }} />
                        <b>{s.name}</b>
                        {s.age ? <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{s.age}y</span> : null}
                      </span>
                    </td>
                    <td className="hide-m">
                      {club ? (
                        <Link href={`/team/${club.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {s.teamLogo && <img src={s.teamLogo} alt="" width={18} height={18} loading="lazy" style={{ width: 18, height: 18, objectFit: "contain" }} />}
                          {s.team}
                        </Link>
                      ) : s.team}
                    </td>
                    <td className="c num"><b>{s.goals}</b></td>
                    <td className="c num">{s.assists}</td>
                    <td className="c num hide-m" style={{ color: "var(--muted)" }}>{s.apps}</td>
                    <td className="c num hide-m" style={{ color: "var(--muted)" }}>{perApp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="foot-src" style={{ marginTop: 12 }}>
        Player statistics: API-Football, latest completed season. Data reusable under{" "}
        <Link href="/data/">CC BY 4.0</Link>.
      </p>
    </main>
  );
}
