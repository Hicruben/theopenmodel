import Link from "next/link";
import { upcomingFixtures } from "@/lib/fixtures";
import { matchProb, marketProbs } from "@/lib/model";
import { pct } from "@/lib/ui";
import { Crest } from "../components/Crest";
import { Kickoff } from "../components/Kickoff";

export const metadata = {
  title: "Top predictions — the clearest upcoming matches",
  description: "Upcoming matches ranked by their highest estimated result chance, with plain-language goal and scoring probabilities.",
};

export default function BestBets() {
  const fx = upcomingFixtures(80);
  const rated = fx.map((f) => {
    const p = matchProb(f.home.elo, f.away.elo);
    const m = marketProbs(f.home.elo, f.away.elo);
    const lean = Math.max(p.home, p.away);
    const pick = p.home >= p.away ? f.home.club : f.away.club;
    return { f, p, m, lean, pick };
  });
  const strongest = [...rated].sort((a, b) => b.lean - a.lean).slice(0, 10);
  const goalsFests = [...rated].sort((a, b) => b.m.over25 - a.m.over25).slice(0, 6);
  const bttsTop = [...rated].sort((a, b) => b.m.btts - a.m.btts).slice(0, 6);

  const Row = ({ r, value, label }: { r: (typeof rated)[0]; value: number; label: string }) => (
    <tr>
      <td>
        <Link href={`/match/${r.f.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Crest club={r.f.home.club} slug={r.f.home.slug} size="sm" />
          {r.f.home.club} <span style={{ color: "var(--muted)", fontWeight: 400 }}>v</span> {r.f.away.club}
          <Crest club={r.f.away.club} slug={r.f.away.slug} size="sm" />
        </Link>
      </td>
      <td className="num" style={{ color: "var(--muted)", fontSize: 11.5 }}><Kickoff iso={r.f.date} /></td>
      <td style={{ fontSize: 13, color: "var(--ink-soft)" }}>{label}</td>
      <td className="num r" style={{ color: "var(--accent)", fontWeight: 700 }}>{pct(value)}</td>
    </tr>
  );

  return (
    <main className="wrap" style={{ maxWidth: 960 }}>
      <p className="crumbs"><Link href="/">Home</Link> › Top predictions</p>
      <h1 className="pagetitle">Most confident predictions</h1>
      <p className="pagedesc">
        Upcoming matches ranked by their highest estimated chance. A 75% result still does not
        happen about one time in four, so these numbers are estimates rather than promises. See our{" "}
        <Link href="/record/">past predictions and results</Link>.
      </p>

      <div className="lg-head" style={{ marginTop: 28 }}><h2>Highest win chances</h2><span className="updated">next 10 matches</span></div>
      <div className="panel tight" style={{ overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Match</th><th>Starts</th><th>Most likely winner</th><th className="r">Chance</th></tr></thead>
          <tbody>{strongest.map((r) => <Row key={r.f.id} r={r} value={r.lean} label={`${r.pick} wins`} />)}</tbody>
        </table>
      </div>

      <div className="grid cols-2" style={{ marginTop: 32 }}>
        <div>
          <div className="lg-head"><h2>Most likely to have 3+ goals</h2><span className="updated">chance of three or more</span></div>
          <div className="panel tight" style={{ overflowX: "auto" }}>
            <table className="data">
              <tbody>{goalsFests.map((r) => <Row key={r.f.id} r={r} value={r.m.over25} label="3 or more total goals" />)}</tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="lg-head"><h2>Both teams to score</h2><span className="updated">highest estimated chance</span></div>
          <div className="panel tight" style={{ overflowX: "auto" }}>
            <table className="data">
              <tbody>{bttsTop.map((r) => <Row key={r.f.id} r={r} value={r.m.btts} label="both teams score" />)}</tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="foot-src" style={{ marginTop: 16 }}>
        These probabilities are information, not a guarantee or betting advice.{" "}
        <Link href="/guide/">How to read the percentages →</Link>
      </p>
    </main>
  );
}
