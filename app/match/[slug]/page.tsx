import Link from "next/link";
import { notFound } from "next/navigation";
import { allFixtures, clubFixtures, fixtureBySlug } from "@/lib/fixtures";
import { matchProb, scoreGrid, marketProbs } from "@/lib/model";
import { seasonOdds } from "@/lib/season";
import { leagueClubs, flagUrl } from "@/lib/data";
import { squadOf } from "@/lib/players";
import { eloHistory, eloDelta, tinySpark } from "@/lib/history";
import { resultByFixtureId } from "@/lib/record";
import { pct, shade } from "@/lib/ui";
import { Crest } from "../../components/Crest";
import { Kickoff } from "../../components/Kickoff";
import { MatchOddsChecker } from "../../components/MatchOddsChecker";

export function generateStaticParams() {
  return allFixtures().map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = fixtureBySlug(slug);
  if (!f) return {};
  const p = matchProb(f.home.elo, f.away.elo);
  return {
    title: `${f.home.club} vs ${f.away.club} prediction — ${f.date.slice(0, 10)}`,
    description: `${f.league.name}: ${f.home.club} win ${(p.home * 100).toFixed(0)}%, draw ${(p.draw * 100).toFixed(0)}%, ${f.away.club} win ${(p.away * 100).toFixed(0)}%. Easy-to-read result chances and possible scores.`,
    alternates: { canonical: `/match/${f.slug}/` },
  };
}

export default async function MatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = fixtureBySlug(slug);
  if (!f) notFound();
  const p = matchProb(f.home.elo, f.away.elo);
  const { grid, top } = scoreGrid(f.home.elo, f.away.elo);
  const mk = marketProbs(f.home.elo, f.away.elo);
  const odds = seasonOdds(f.league.slug, leagueClubs(f.league));
  const oH = odds.find((o) => o.slug === f.home.slug);
  const oA = odds.find((o) => o.slug === f.away.slug);
  const rankH = odds.findIndex((o) => o.slug === f.home.slug) + 1;
  const rankA = odds.findIndex((o) => o.slug === f.away.slug) + 1;
  const attackers = (id?: number) => squadOf(id).filter((x) => x.position === "Attacker").slice(0, 3);
  const pickTxt = p.home > p.away && p.home > p.draw ? f.home.club
    : p.away > p.home && p.away > p.draw ? f.away.club : "Draw";
  const pickSide = p.home > p.away && p.home > p.draw ? "home"
    : p.away > p.home && p.away > p.draw ? "away" : "draw";
  const best = top[0];
  const finalResult = resultByFixtureId(f.id);
  const actualSide = finalResult
    ? finalResult.hg > finalResult.ag ? "home" : finalResult.ag > finalResult.hg ? "away" : "draw"
    : null;
  const pickHit = actualSide != null ? actualSide === pickSide : null;

  // Recent 6-month Elo momentum for both clubs
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
  const histH = eloHistory(f.home.slug).filter((pt) => pt.date >= sixMonthsAgo);
  const histA = eloHistory(f.away.slug).filter((pt) => pt.date >= sixMonthsAgo);
  const deltaH = eloDelta(f.home.slug, 60);
  const deltaA = eloDelta(f.away.slug, 60);
  const sparkH = tinySpark(histH, 160, 36);
  const sparkA = tinySpark(histA, 160, 36);

  // Next upcoming fixture for each club (after this match)
  const nowIso = new Date().toISOString();
  const nextH = clubFixtures(f.home.slug).find((x) => x.slug !== f.slug && x.date > nowIso);
  const nextA = clubFixtures(f.away.slug).find((x) => x.slug !== f.slug && x.date > nowIso);

  const oddsMarkets = [
    { id: "home", label: `${f.home.club} win`, prob: p.home },
    { id: "draw", label: "Draw", prob: p.draw },
    { id: "away", label: `${f.away.club} win`, prob: p.away },
    { id: "btts", label: "Both teams score", prob: mk.btts },
    { id: "over25", label: "Over 2.5 goals", prob: mk.over25 },
    { id: "under25", label: "Under 2.5 goals", prob: Math.max(0.001, 1 - mk.over25) },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${f.home.club} vs ${f.away.club}`,
    startDate: f.date,
    sport: "Soccer",
    location: f.venue ? { "@type": "Place", name: f.venue, address: f.city ?? undefined } : undefined,
    homeTeam: { "@type": "SportsTeam", name: f.home.club },
    awayTeam: { "@type": "SportsTeam", name: f.away.club },
  };

  return (
    <main className="wrap" style={{ maxWidth: 980 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="crumbs">
        <Link href="/">Home</Link> › <Link href="/matches/">Predictions</Link> › {f.home.club} vs {f.away.club}
      </p>

      <section className="panel" style={{ marginTop: 14, padding: "26px 28px" }}>
        <p className="updated" style={{ margin: "0 0 18px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="flag" src={flagUrl(f.league.flagCode, 20)} width={16} height={12} alt="" />
          {f.league.name} · {f.round} · <Kickoff iso={f.date} />
          {f.venue && <> · {f.venue}{f.city ? `, ${f.city}` : ""}</>}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center" }}>
          <Link href={`/team/${f.home.slug}/`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <Crest club={f.home.club} slug={f.home.slug} size="xl" />
            <b style={{ fontFamily: "var(--font-head)", fontSize: 20, textAlign: "center" }}>{f.home.club}</b>
            <span className="mono tnum" style={{ fontSize: 11, color: "var(--muted)" }}>Team strength {f.home.elo} · projected league finish #{rankH}</span>
          </Link>
          <div style={{ textAlign: "center" }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".14em" }}>MOST LIKELY RESULT</div>
            <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 30, color: "var(--accent)", margin: "4px 0" }}>
              {pickTxt}
            </div>
            <div className="mono tnum" style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              single most likely score: {best.h}–{best.a} ({pct(best.p)})
            </div>
          </div>
          <Link href={`/team/${f.away.slug}/`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <Crest club={f.away.club} slug={f.away.slug} size="xl" />
            <b style={{ fontFamily: "var(--font-head)", fontSize: 20, textAlign: "center" }}>{f.away.club}</b>
            <span className="mono tnum" style={{ fontSize: 11, color: "var(--muted)" }}>Team strength {f.away.elo} · projected league finish #{rankA}</span>
          </Link>
        </div>
        <div className="probbar anim" style={{ marginTop: 22 }} aria-hidden>
          <span className="h" style={{ width: `${(p.home * 100).toFixed(1)}%` }} />
          <span className="d" style={{ width: `${(p.draw * 100).toFixed(1)}%` }} />
          <span className="a" style={{ width: `${(p.away * 100).toFixed(1)}%` }} />
        </div>
        <div className="problegend" style={{ justifyContent: "center" }}>
          <span className="k"><span className="sw" style={{ background: "var(--win)" }} />{f.home.club} wins <b className="tnum">{pct(p.home)}</b></span>
          <span className="k"><span className="sw" style={{ background: "var(--draw)" }} />Draw — neither team wins <b className="tnum">{pct(p.draw)}</b></span>
          <span className="k"><span className="sw" style={{ background: "var(--loss)" }} />{f.away.club} wins <b className="tnum">{pct(p.away)}</b></span>
          <span className="mono" style={{ color: "var(--muted)" }}>Average simulated goals {p.xgHome.toFixed(2)}–{p.xgAway.toFixed(2)}</span>
        </div>
        <p className="match-probability-note">
          These three percentages add to 100%. They show what may happen, not what will happen.
        </p>
      </section>

      {finalResult && (
        <section
          className="panel"
          style={{
            marginTop: 18,
            borderLeft: `3px solid ${pickHit ? "var(--win)" : "var(--loss)"}`,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <span className="eyebrow plain">Final result vs model</span>
            <p style={{ margin: "6px 0 0", fontSize: 15, color: "var(--ink)" }}>
              Full time: <b className="mono tnum">{f.home.club} {finalResult.hg}–{finalResult.ag} {f.away.club}</b>{" "}
              · Top pick ({pickTxt}) was{" "}
              <b style={{ color: pickHit ? "var(--win)" : "var(--loss)" }}>
                {pickHit ? "correct" : "a miss"}
              </b>.
            </p>
          </div>
          <Link href="/record/" className="mono" style={{ fontSize: 12, textDecoration: "underline" }}>
            See full public track record →
          </Link>
        </section>
      )}

      <MatchOddsChecker markets={oddsMarkets} defaultId={pickSide} />

      {(sparkH || sparkA) && (
        <section className="panel" style={{ marginTop: 22 }}>
          <span className="eyebrow plain">Recent form &amp; 6-month Elo momentum</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 14 }}>
            {[
              { club: f.home, rank: rankH, delta: deltaH, spark: sparkH },
              { club: f.away, rank: rankA, delta: deltaA, spark: sparkA },
            ].map(({ club, rank, delta, spark }) => (
              <div
                key={club.slug}
                style={{
                  border: "1px solid var(--rule-strong)",
                  borderRadius: 2,
                  background: "var(--paper)",
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <Link href={`/team/${club.slug}/`} style={{ fontWeight: 600, fontSize: 15 }}>
                    {club.club}
                  </Link>
                  <div className="mono tnum" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Elo {club.elo} · Proj. #{rank}
                  </div>
                  {delta != null && (
                    <div
                      className="mono tnum"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        marginTop: 4,
                        color: delta > 0 ? "var(--win)" : delta < 0 ? "var(--loss)" : "var(--muted)",
                      }}
                    >
                      {delta > 0 ? `+${delta}` : delta} Elo (last 60d)
                    </div>
                  )}
                </div>
                {spark && (
                  <svg width="160" height="36" viewBox="0 0 160 36" aria-label={`${club.club} 6-month Elo trend`}>
                    <path d={spark} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <p style={{ fontSize: 14.5, color: "var(--ink-soft)", margin: "22px 0 0", maxWidth: 760 }}>
        <b>Why does {pickTxt} have the highest number?</b>{" "}
        {f.home.elo >= f.away.elo ? f.home.club : f.away.club} currently has the stronger
        recent-results rating. The calculation also allows for {f.home.club} playing at home.
        Across many simulated versions of this match, the average goal totals are {p.xgHome.toFixed(2)}
        for {f.home.club} and {p.xgAway.toFixed(2)} for {f.away.club}. That makes {pickTxt} the highest
        of the three result estimates at {pct(Math.max(p.home, p.draw, p.away))}.{" "}
        {oH && oA && (
          <>For the full league season, {f.home.club} is projected to earn about {oH.avgPts.toFixed(0)}
          points and {f.away.club} about {oA.avgPts.toFixed(0)}.</>
        )}{" "}
        <Link href="/guide/">Read the beginner&apos;s guide</Link> or{" "}
        <Link href="/methodology/">see the technical calculation</Link>.
      </p>

      <section className="panel" style={{ marginTop: 22, maxWidth: 760, borderLeft: "2px solid var(--accent)" }}>
        <span className="eyebrow plain">Model reading — citable summary</span>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, margin: "10px 0 0", color: "var(--ink)" }}>
          The Open Model gives <b>{f.home.club}</b> a <b className="tnum">{pct(p.home)}</b> chance of
          beating <b>{f.away.club}</b> at home in the {f.league.name} on {f.date.slice(0, 10)}, with{" "}
          <b className="tnum">{pct(p.draw)}</b> for the draw and <b className="tnum">{pct(p.away)}</b>{" "}
          for an away win. The single most likely score is <b className="tnum">{best.h}–{best.a}</b>{" "}
          ({pct(best.p)}), with average simulated goals of {p.xgHome.toFixed(2)}–{p.xgAway.toFixed(2)};
          the chance of both teams scoring is {pct(mk.btts)} and of three or more total goals{" "}
          {pct(mk.over25)}. Estimates come from an Elo → Dixon-Coles → Monte Carlo model,
          walk-forward backtested on 913 internationals (ranked probability score 0.175 vs 0.241 for
          random guessing) with a <Link href="/record/">public prediction record</Link>.
        </p>
        <p className="foot-src">
          Source: The Open Model (theopenmodel.com) · probabilities as of the latest daily build ·
          data reusable under <Link href="/data/">CC BY 4.0 with attribution</Link>.
        </p>
      </section>

      <div className="grid cols-2" style={{ marginTop: 26 }}>
        <div className="panel">
          <span className="eyebrow plain">Possible final scores</span>
          <div style={{ overflowX: "auto" }}>
          <table className="data" style={{ marginTop: 12, minWidth: 320 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}></th>
                {[0, 1, 2, 3, 4, "5+"].map((a) => <th key={a} className="c">{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, h) => (
                <tr key={h}>
                  <td className="num" style={{ color: "var(--muted)" }}>{h === 5 ? "5+" : h}</td>
                  {row.map((v, a) => (
                    <td key={a} className="num" style={{ ...shade(Math.min(1, v * 6), "green"), fontSize: 11.5 }}>
                      {(v * 100).toFixed(1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="foot-src">Home-team goals run down the left; away-team goals run across the top. Each cell is that score&apos;s estimated chance.</p>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 18 }}>
            <span className="eyebrow plain">Most likely scores</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {top.slice(0, 6).map((s) => (
                <span key={`${s.h}-${s.a}`} className="mono tnum" style={{
                  border: "1px solid var(--rule-strong)", borderRadius: 9, padding: "7px 12px", fontSize: 13,
                }}>
                  <b>{s.h}–{s.a}</b> <span style={{ color: "var(--muted)" }}>{pct(s.p)}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="panel" style={{ marginBottom: 18 }}>
            <span className="eyebrow plain">Other match possibilities</span>
            <table className="data" style={{ marginTop: 10 }}>
              <tbody>
                {[
                  ["Both teams to score", mk.btts],
                  ["2 or more total goals", mk.over15],
                  ["3 or more total goals", mk.over25],
                  ["4 or more total goals", mk.over35],
                  [`${f.home.club} avoids defeat`, mk.dc1x],
                  [`${f.away.club} avoids defeat`, mk.dcx2],
                  [`${f.home.club} allows no goals`, mk.homeCleanSheet],
                  [`${f.away.club} allows no goals`, mk.awayCleanSheet],
                ].map(([label, v]) => (
                  <tr key={label as string}>
                    <td style={{ fontSize: 13, color: "var(--ink-soft)" }}>{label as string}</td>
                    <td style={{ width: 110 }}>
                      <span className="barcell"><i className="green" style={{ width: `${(v as number) * 100}%` }} /></span>
                    </td>
                    <td className="num r" style={{ fontWeight: 600 }}>{pct(v as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <span className="eyebrow plain">Season outlook</span>
            <table className="data" style={{ marginTop: 10 }}>
              <thead>
                <tr><th>Club</th><th className="r">Expected points</th><th className="c">Champion</th><th className="c">Top four</th><th className="c">Relegation</th></tr>
              </thead>
              <tbody>
                {[{ o: oH, c: f.home, r: rankH }, { o: oA, c: f.away, r: rankA }].map(({ o, c }) => o && (
                  <tr key={c.slug}>
                    <td><Link href={`/team/${c.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Crest club={c.club} slug={c.slug} size="sm" />{c.club}</Link></td>
                    <td className="num r">{o.avgPts.toFixed(0)}</td>
                    <td className="num" style={shade(o.title, "gold")}>{pct(o.title)}</td>
                    <td className="num" style={shade(o.top4, "green")}>{pct(o.top4)}</td>
                    <td className="num" style={shade(o.releg, "red")}>{pct(o.releg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(attackers(f.home.apiId).length > 0 || attackers(f.away.apiId).length > 0) && (
        <div style={{ marginTop: 26 }}>
          <div className="lg-head"><h2>Forwards to watch</h2><span className="updated">2026–27 squads · API-Football</span></div>
          <div className="players" style={{ marginTop: 14 }}>
            {[...attackers(f.home.apiId), ...attackers(f.away.apiId)].map((pl) => (
              <div key={pl.name} className="playercard">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="face" src={pl.photo} alt={pl.name} loading="lazy" />
                <div className="nm">{pl.name}</div>
                <div className="meta">{pl.position}{pl.age ? ` · ${pl.age}y` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(nextH || nextA) && (
        <section className="panel" style={{ marginTop: 26 }}>
          <span className="eyebrow plain">Upcoming matches for these clubs</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
            {[nextH, nextA].filter((x): x is NonNullable<typeof x> => Boolean(x)).map((nx) => (
              <Link
                key={nx.slug}
                href={`/match/${nx.slug}/`}
                className="panel-link"
                style={{
                  border: "1px solid var(--rule-strong)",
                  borderRadius: 2,
                  background: "var(--paper)",
                  padding: "11px 14px",
                  textDecoration: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span>
                  <b style={{ display: "block", fontSize: 14, color: "var(--ink)" }}>
                    {nx.home.club} vs {nx.away.club}
                  </b>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {nx.league.name} · {nx.date.slice(0, 10)}
                  </span>
                </span>
                <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>Preview →</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
