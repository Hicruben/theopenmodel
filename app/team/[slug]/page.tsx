import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAGUES, clubBySlug, leagueClubs, topTeams, flagUrl } from "@/lib/data";
import { matchProb } from "@/lib/model";
import { seasonOdds } from "@/lib/season";
import { eloHistory, sparkPath } from "@/lib/history";
import { pct, shade } from "@/lib/ui";
import { keyPlayers } from "@/lib/players";
import { clubFixtures } from "@/lib/fixtures";
import { latestNews, timeAgo } from "@/lib/news";
import { Crest } from "../../components/Crest";
import { MatchCard } from "../../components/MatchCard";

export function generateStaticParams() {
  // Every club that appears in a league table gets a page.
  return LEAGUES.flatMap((l) => leagueClubs(l)).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = clubBySlug(slug);
  if (!club) return {};
  return {
    title: `${club.club} — Elo trend, title odds & win probabilities`,
    description: `${club.club}: Elo ${club.elo}, five-year rating trend, 2026-27 title/top-4 odds and model win probabilities vs every opponent.`,
  };
}

const BUILT = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = clubBySlug(slug);
  if (!club) notFound();
  const league = LEAGUES.find((l) => l.country === club.country);
  const clubs = league ? leagueClubs(league) : [];
  const leagueOdds = league ? seasonOdds(league.slug, clubs) : [];
  const odds = leagueOdds.find((o) => o.slug === club.slug);
  const rank = leagueOdds.findIndex((o) => o.slug === club.slug) + 1;
  const rivals = (clubs.length ? clubs : topTeams(10)).filter((c) => c.slug !== club.slug);
  const hist = eloHistory(club.slug);
  const spark = sparkPath(hist);
  const ticks: { x: number; label: string }[] = [];
  if (hist.length > 1) {
    const step = (640 - 12) / (hist.length - 1);
    let prev = "";
    hist.forEach((pt, i) => {
      const y = pt.date.slice(0, 4);
      if (y !== prev) { if (prev) ticks.push({ x: 6 + i * step, label: y }); prev = y; }
    });
  }

  return (
    <main className="wrap">
      <section>
        <p className="crumbs">
          <Link href="/">Home</Link> › {league ? <Link href={`/league/${league.slug}/`}>{league.name}</Link> : club.country} › {club.club}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "10px 0 4px" }}>
          <Crest club={club.club} slug={club.slug} size="xl" />
          <div>
            <h1 className="pagetitle" style={{ margin: 0 }}>{club.club}</h1>
            <p className="updated" style={{ margin: "3px 0 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {league && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="flag" src={flagUrl(league.flagCode, 20)} width={15} height={11} alt="" />
              )}
              {league?.name ?? club.country}
              {rank > 0 && <> · forecast {rank}{rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th"} of {leagueOdds.length}</>}
              {" "}· updated {BUILT}
            </p>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "10px 0 0" }} className="tnum">
          <b>Elo {club.elo}</b>
          {odds && (
            <>
              {" "}· title <b style={{ color: "var(--accent-ink)" }}>{pct(odds.title)}</b>
              {" "}· top 4 <b>{pct(odds.top4)}</b>
              {" "}· relegation <b>{pct(odds.releg)}</b>
              {" "}· expected points <b>{odds.avgPts.toFixed(0)}</b>
            </>
          )}
          <span style={{ color: "var(--muted)" }}> — 5,000 simulated seasons</span>
        </p>
      </section>

      {spark.d && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="chart-meta">
            <span className="eyebrow plain">Elo rating since 2020</span>
            <span className="mono tnum" style={{ fontSize: 11, color: "var(--muted)" }}>
              range {spark.min}–{spark.max} · {hist.length} rating periods · source: ClubElo
            </span>
          </div>
          <svg viewBox="0 0 640 178" style={{ width: "100%", height: "auto", marginTop: 14, display: "block" }} role="img"
            aria-label={`${club.club} Elo trend since 2020`}>
            {[0, 0.33, 0.66, 1].map((f) => (
              <line key={f} x1="6" x2="634" y1={6 + f * 148} y2={6 + f * 148} stroke="var(--rule)" strokeWidth="1" />
            ))}
            <text className="axis-label" x="6" y={12}>{spark.max}</text>
            <text className="axis-label" x="6" y={158}>{spark.min}</text>
            {ticks.map((t) => (
              <g key={t.label}>
                <line x1={t.x} x2={t.x} y1="6" y2="154" stroke="var(--rule)" strokeWidth="1" strokeDasharray="2 4" />
                <text className="axis-label" x={t.x + 4} y="172">{t.label}</text>
              </g>
            ))}
            <path d={spark.d} fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx={spark.last.x} cy={spark.last.y} r="3.5" fill="var(--accent)" />
            <text className="axis-label" x={Math.min(spark.last.x + 8, 596)} y={Math.max(spark.last.y + 3, 12)} style={{ fontWeight: 600, fill: "var(--accent-ink)" }}>
              {club.elo}
            </text>
          </svg>
        </div>
      )}

      {latestNews(4, [club.club]).length > 0 && (
        <section data-reveal>
          <div className="lg-head" style={{ marginTop: 34 }}>
            <h2>In the news</h2>
            <span className="updated">headlines link out · sources credited</span>
          </div>
          <div className="grid cols-2" style={{ marginTop: 14 }}>
            {latestNews(4, [club.club]).map((i) => (
              <a key={i.link} href={i.link} target="_blank" rel="noopener nofollow" className="panel panel-link"
                style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: i.img ? "92px 1fr" : "1fr", gap: 14, alignItems: "center" }}>
                {i.img && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={i.img} alt="" width={92} height={64} loading="lazy"
                    style={{ width: 92, height: 64, objectFit: "cover", borderRadius: 9, border: "1px solid var(--rule)", background: "var(--panel-2)" }} />
                )}
                <span>
                  <span style={{ fontSize: 14, fontWeight: 600, display: "block", lineHeight: 1.4 }}>{i.title}</span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{i.src} · {timeAgo(i.date)} ↗</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {clubFixtures(club.slug, 3).length > 0 && (
        <section data-reveal>
          <div className="lg-head" style={{ marginTop: 34 }}>
            <h2>Next up</h2>
            <span className="updated">2026-27 fixtures · model odds</span>
          </div>
          <div className="grid cols-3" style={{ marginTop: 14 }}>
            {clubFixtures(club.slug, 3).map((f) => <MatchCard key={f.id} f={f} />)}
          </div>
        </section>
      )}

      {keyPlayers(club.apiId).length > 0 && (
        <section data-reveal>
          <div className="lg-head" style={{ marginTop: 34 }}>
            <h2>The squad&apos;s spine</h2>
            <span className="updated">2026-27 squad · API-Football</span>
          </div>
          <div className="players" style={{ marginTop: 14 }}>
            {keyPlayers(club.apiId).map((p) => (
              <div key={p.name} className="playercard">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="face" src={p.photo} alt={p.name} loading="lazy" />
                <div className="nm">{p.name}</div>
                <div className="meta">{p.position}{p.number ? ` · #${p.number}` : ""}{p.age ? ` · ${p.age}y` : ""}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {rivals.length > 0 && (
        <>
          <div className="lg-head" style={{ marginTop: 34 }}>
            <h2>2026-27, opponent by opponent</h2>
            {league && <Link href={`/league/${league.slug}/table/`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>Full {league.name} table →</Link>}
          </div>
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table className="data forecast">
              <thead>
                <tr>
                  <th>Opponent</th>
                  <th className="r">Elo</th>
                  <th className="c" style={{ width: 90 }} title={`${club.club} win probability at home`}>Win at home</th>
                  <th className="c" style={{ width: 76 }} title="Draw probability at home">Draw</th>
                  <th className="c" style={{ width: 90 }} title={`${club.club} win probability away`}>Win away</th>
                  <th className="r" title="Expected goals for the home fixture">xG (home)</th>
                </tr>
              </thead>
              <tbody>
                {rivals.map((r) => {
                  const home = matchProb(club.elo, r.elo);
                  const away = matchProb(r.elo, club.elo);
                  return (
                    <tr key={r.slug}>
                      <td>
                        <Link href={`/team/${r.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                          <Crest club={r.club} slug={r.slug} size="sm" />{r.club}
                        </Link>
                      </td>
                      <td className="num r" style={{ color: "var(--muted)" }}>{r.elo}</td>
                      <td className="num" style={shade(home.home, "green")}>{pct(home.home)}</td>
                      <td className="num" style={shade(home.draw, "gold")}>{pct(home.draw)}</td>
                      <td className="num" style={shade(away.away, "green")}>{pct(away.away)}</td>
                      <td className="num r" style={{ color: "var(--ink-soft)" }}>{home.xgHome.toFixed(2)}–{home.xgAway.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="foot-src">
              Elo difference → expected goals → Dixon-Coles scoreline grid. Home advantage +65 Elo.{" "}
              <Link href="/methodology/">Method →</Link>
            </p>
          </div>
        </>
      )}
    </main>
  );
}
