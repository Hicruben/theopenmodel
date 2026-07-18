import Link from "next/link";
import { LEAGUES, leagueClubs, flagUrl } from "@/lib/data";
import { eloDelta, eloHistory, tinySpark } from "@/lib/history";
import { Crest } from "../components/Crest";

export const metadata = {
  title: "Teams getting stronger or weaker",
  description: "See which clubs changed most in the results-based team-strength rating over the last six and twelve months.",
};

const BUILT = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function Movers() {
  const rows = LEAGUES.flatMap((l) =>
    leagueClubs(l).map((c) => ({
      ...c, league: l,
      d180: eloDelta(c.slug, 180),
      d365: eloDelta(c.slug, 365),
    }))
  ).filter((r) => r.d180 !== null);

  const risers = [...rows].sort((a, b) => (b.d180! - a.d180!)).slice(0, 12);
  const fallers = [...rows].sort((a, b) => (a.d180! - b.d180!)).slice(0, 12);

  const Table = ({ list, tone }: { list: typeof rows; tone: "up" | "down" }) => (
    <div className="panel tight" style={{ overflowX: "auto" }}>
      <table className="data">
        <thead>
          <tr>
            <th>Club</th><th>League</th><th>Trend</th>
            <th className="r">Strength</th><th className="r">Change · 6 months</th><th className="r">Change · 12 months</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const hist = eloHistory(r.slug);
            const d = hist.length > 1 ? tinySpark(hist) : "";
            return (
              <tr key={r.slug}>
                <td>
                  <Link href={`/team/${r.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <Crest club={r.club} slug={r.slug} size="sm" />{r.club}
                  </Link>
                </td>
                <td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="flag" src={flagUrl(r.league.flagCode, 20)} width={16} height={12} alt="" />
                </td>
                <td className="sparkcell">
                  {d && <svg viewBox="0 0 76 20" width={76} height={20} aria-hidden><path d={d} fill="none" strokeWidth="1.3" /></svg>}
                </td>
                <td className="num r">{r.elo}</td>
                <td className="num r" style={{ color: tone === "up" ? "var(--accent)" : "var(--loss)", fontWeight: 600 }}>
                  {r.d180! > 0 ? "+" : ""}{r.d180}
                </td>
                <td className="num r" style={{ color: "var(--muted)" }}>
                  {r.d365 === null ? "—" : `${r.d365 > 0 ? "+" : ""}${r.d365}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <main className="wrap">
      <p className="crumbs"><Link href="/">Home</Link> › Team-strength changes</p>
      <h1 className="pagetitle">Which teams are getting stronger?</h1>
      <p className="pagedesc">
        This score rises when a club produces stronger results and falls when results worsen. Here
        are the biggest changes among the 96 clubs we cover.
      </p>
      <p className="updated" style={{ margin: "6px 0 24px" }}>Updated {BUILT} · source: ClubElo rating periods since 2020</p>

      <div className="lg-head"><h2 style={{ color: "var(--accent)" }}>▲ Improved most</h2><span className="updated">last six months</span></div>
      <Table list={risers} tone="up" />

      <div className="lg-head" style={{ marginTop: 40 }}><h2 style={{ color: "var(--loss)" }}>▼ Declined most</h2><span className="updated">last six months</span></div>
      <Table list={fallers} tone="down" />

      <p className="foot-src" style={{ marginTop: 18 }}>
        “Change” compares the ClubElo team-strength score between two dates.{" "}
        <Link href="/guide/">How team strength affects a prediction →</Link>
      </p>
    </main>
  );
}
