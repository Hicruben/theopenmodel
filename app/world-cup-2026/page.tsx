import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface KO { date: string; round: string; t1: string; t2: string; g1: number; g2: number; pick: string; pTop: number; correct: boolean }
interface Final { champion: string; runnerUp: string; finalScore: string; thirdPlace: string; finished: number; modelRecord: string; knockout: KO[] }

function data(): Final {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "wc2026-final.json"), "utf8"));
}

export const metadata = {
  title: "World Cup 2026 — how the open model did (archive)",
  description:
    "The 2026 FIFA World Cup archive: Spain champions. The open-source Elo → Dixon-Coles → Monte Carlo model called 71 of 104 results, correctly picking Spain in the final. Full knockout record, backtest and open data.",
};

const ROUND_ORDER = ["Round of 16", "Quarter-final", "Semi-final", "Match for third place", "Final"];

export default function WorldCup2026() {
  const d = data();
  const ko = [...d.knockout].sort(
    (a, b) => (ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round)) || a.date.localeCompare(b.date),
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: "2026 FIFA World Cup",
    sport: "Soccer",
    startDate: "2026-06-11",
    endDate: "2026-07-19",
    location: { "@type": "Place", name: "United States, Canada & Mexico" },
    winner: { "@type": "SportsTeam", name: d.champion },
  };

  return (
    <main className="wrap prose">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="hero">
        <span className="badge gold">2026 World Cup · archive</span>
        <h1>The model at the 2026 World Cup</h1>
        <p className="dek">
          <b>{d.champion}</b> won the 2026 FIFA World Cup, beating {d.runnerUp} {d.finalScore} in the
          final. The same open-source engine that now runs{" "}
          <Link href="/">The Open Model</Link> on club football forecast the whole tournament in the
          open — every pick published before kickoff, right and wrong kept on the record.
        </p>
      </section>

      <div style={{ display: "flex", gap: "clamp(24px, 5vw, 64px)", flexWrap: "wrap", margin: "6px 0 32px" }}>
        <div className="stat"><div className="num tnum">{d.modelRecord}</div><div className="lbl">Correct top picks (full tournament)</div></div>
        <div className="stat"><div className="num tnum">{d.champion}</div><div className="lbl">Champions — model&apos;s pick in the final</div></div>
        <div className="stat"><div className="num tnum">Open</div><div className="lbl">Source, methodology & data public</div></div>
      </div>

      <p>
        This page is the permanent home of the World Cup 2026 project, which previously lived at
        cup26matches.com. The engine — <b>Elo ratings → Dixon-Coles bivariate Poisson → Monte Carlo
        simulation</b> — is the same one behind The Open Model&apos;s club-season forecasts. For the
        full accuracy record, calibration curve and the 913-international backtest, see the{" "}
        <Link href="/record/">public track record</Link>; the model is open-source on{" "}
        <a href="https://github.com/Hicruben/world-cup-2026-prediction-model">GitHub</a>.
      </p>

      <h2>Knockout stage — the model&apos;s call vs the result</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="data">
          <thead>
            <tr>
              <th>Round</th>
              <th>Match</th>
              <th className="r">Result</th>
              <th>Model&apos;s pick</th>
              <th className="c">Hit</th>
            </tr>
          </thead>
          <tbody>
            {ko.map((m, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>{m.round}</td>
                <td>{m.t1} v {m.t2}</td>
                <td className="num r" style={{ whiteSpace: "nowrap" }}>{m.g1}–{m.g2}</td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>{m.pick} <span style={{ color: "var(--muted)" }}>{m.pTop}%</span></td>
                <td className="c" style={{ color: m.correct ? "var(--win)" : "var(--loss)", fontWeight: 700 }}>{m.correct ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="foot-src">
        Picks are the model&apos;s highest pre-match outcome at neutral venues; a knockout decided
        after a draw (extra time / penalties) counts the pick correct only if it named the side that
        advanced on the day. Full match-by-match data:{" "}
        <a href="/data/wc-backtest.json" download>backtest JSON</a>.
      </p>

      <h2>Where the model runs now</h2>
      <p>
        The tournament is over, but the model isn&apos;t. It now forecasts the{" "}
        <Link href="/leagues/">Premier League, La Liga, Serie A, Bundesliga and Ligue 1</Link>{" "}
        season, updated daily, under the same policy: <Link href="/matches/">every match</Link>{" "}
        predicted before kickoff and <Link href="/record/">checked afterwards</Link>. The forecast
        data is free to reuse under <Link href="/data/">CC BY 4.0</Link>.
      </p>
    </main>
  );
}
