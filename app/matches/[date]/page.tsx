import Link from "next/link";
import { notFound } from "next/navigation";
import { fixtureDates, fixturesOn } from "@/lib/fixtures";
import { LEAGUES, flagUrl } from "@/lib/data";
import { matchProb } from "@/lib/model";
import { pct } from "@/lib/ui";
import { Crest } from "../../components/Crest";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function generateStaticParams() {
  return fixtureDates().map((date) => ({ date }));
}

const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!ISO.test(date)) return {};
  const n = fixturesOn(date).length;
  return {
    title: `Football matches ${date} — fixtures & predictions`,
    description: `All ${n} top-five-league fixtures on ${longDate(date)} with the model's home-win, draw and away-win probability. Kick-off times and result forecasts.`,
  };
}

export default async function MatchCentreDate({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!ISO.test(date)) notFound();
  const dates = fixtureDates();
  const idx = dates.indexOf(date);
  if (idx === -1) notFound();

  const prev = dates[idx - 1];
  const next = dates[idx + 1];
  const fixtures = fixturesOn(date);

  // Group by league in canonical order.
  const byLeague = LEAGUES.map((l) => ({ league: l, fx: fixtures.filter((f) => f.league.slug === l.slug) }))
    .filter((g) => g.fx.length > 0);

  // A rail of nearby match dates for quick hopping.
  const railStart = Math.max(0, idx - 3);
  const rail = dates.slice(railStart, railStart + 7);

  return (
    <main className="wrap">
      <p className="crumbs"><Link href="/">Home</Link> › <Link href="/matches/">Matches</Link> › {date}</p>
      <h1 className="pagetitle" style={{ marginTop: 6 }}>Matches — {longDate(date)}</h1>
      <p className="pagedesc">
        Every {LEAGUES.length}-league fixture kicking off on this date, each with the model&apos;s
        estimated chance of a home win, draw or away win. {fixtures.length} matches.
      </p>

      <nav className="date-nav" aria-label="Match dates">
        {prev ? <Link className="date-nav-arrow" href={`/matches/${prev}/`} rel="prev" aria-label="Previous match day">‹ {shortDate(prev)}</Link> : <span className="date-nav-arrow is-off">‹</span>}
        <span className="date-rail">
          {rail.map((d) => (
            <Link key={d} href={`/matches/${d}/`} className={d === date ? "on" : undefined} aria-current={d === date ? "date" : undefined}>
              {shortDate(d)}
            </Link>
          ))}
        </span>
        {next ? <Link className="date-nav-arrow" href={`/matches/${next}/`} rel="next" aria-label="Next match day">{shortDate(next)} ›</Link> : <span className="date-nav-arrow is-off">›</span>}
      </nav>

      {byLeague.map(({ league, fx }) => (
        <section key={league.slug} style={{ marginTop: 26 }}>
          <div className="lg-head">
            <h2 style={{ fontSize: 18, display: "inline-flex", alignItems: "center", gap: 9 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="flag" src={flagUrl(league.flagCode, 20)} width={16} height={12} alt="" />
              <Link href={`/league/${league.slug}/`} style={{ textDecoration: "none", color: "inherit" }}>{league.name}</Link>
            </h2>
            <span className="updated">{fx.length} {fx.length === 1 ? "match" : "matches"}</span>
          </div>
          <div className="fixture-rows" style={{ marginTop: 12 }}>
            {fx.map((f) => {
              const p = matchProb(f.home.elo, f.away.elo);
              return (
                <Link key={f.id} href={`/match/${f.slug}/`} className="fixture-row">
                  <span className="fx-date mono">{timeLabel(f.date)}</span>
                  <span className="fx-team fx-home"><b>{f.home.club}</b><Crest club={f.home.club} slug={f.home.slug} size="sm" /></span>
                  <span className="fx-vs mono">v</span>
                  <span className="fx-team fx-away"><Crest club={f.away.club} slug={f.away.slug} size="sm" /><b>{f.away.club}</b></span>
                  <span className="fx-odds mono" aria-label="Model probabilities">
                    <span className="fx-p" style={p.home >= p.draw && p.home >= p.away ? { color: "var(--win)", fontWeight: 700 } : undefined}>{pct(p.home, 0)}</span>
                    <span className="fx-p" style={p.draw >= p.home && p.draw >= p.away ? { color: "var(--ink)", fontWeight: 700 } : { color: "var(--muted)" }}>{pct(p.draw, 0)}</span>
                    <span className="fx-p" style={p.away >= p.home && p.away >= p.draw ? { color: "var(--win)", fontWeight: 700 } : undefined}>{pct(p.away, 0)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <p className="foot-src" style={{ marginTop: 20 }}>
        Kick-off times in UTC (each match page shows your local time). Probabilities from the model —
        see the <Link href="/record/">public record</Link>. Reusable under <Link href="/data/">CC BY 4.0</Link>.
      </p>
    </main>
  );
}
