import Link from "next/link";
import { wcBacktest, clubRecord } from "@/lib/record";
import { CalibrationChart } from "../components/CalibrationChart";
import { pct } from "@/lib/ui";

export const metadata = {
  title: "Past predictions and results — checking our work",
  description:
    "The model's public track record: walk-forward backtest on 913 internationals, World Cup 2026 results, calibration charts and the live 2026-27 club-season record. Right and wrong both stay visible.",
};

const f3 = (x: number) => x.toFixed(3);

export default function Record() {
  const bt = wcBacktest();
  const club = clubRecord();

  return (
    <main className="wrap prose">
      <section className="hero">
        <span className="badge gold">Checking our work</span>
        <h1>Past predictions and results</h1>
        <p className="dek">
          Before kickoff, we publish the chance of a home win, draw and away win, then mark the
          highest number as the most likely result. After full time, we record whether that top pick
          was correct. Right and wrong results both stay visible.
        </p>
      </section>

      <div style={{ display: "flex", gap: "clamp(24px, 5vw, 64px)", flexWrap: "wrap", margin: "6px 0 34px" }}>
        <div className="stat"><div className="num tnum">70/102</div><div className="lbl">Correct World Cup top picks</div></div>
        <div className="stat"><div className="num tnum">4/4</div><div className="lbl">Final four teams identified early</div></div>
        {club.n > 0 ? (
          <div className="stat"><div className="num tnum">{club.hits}/{club.n}</div><div className="lbl">Correct club-season top picks</div></div>
        ) : (
          <div className="stat"><div className="num tnum">Aug</div><div className="lbl">Club-season record starts 2026-27</div></div>
        )}
      </div>

      {club.n > 0 && (
        <>
          <h2>Club season 2026-27 — live record</h2>
          <blockquote>
            <b>{club.hits} correct top picks from {club.n} completed matches</b> ({pct(club.accuracy)}).
            Probabilities are locked in the daily forecast snapshot before kickoff and scored against
            the final result. A draw counts as a miss when a team was the top pick. Three-outcome
            Brier score <b>{f3(club.brier)}</b> (random guessing scores 0.667; lower is better)
            {club.favouriteCount > 0 && (
              <> · clear favourites (≥50%) correct {club.favouriteHits}/{club.favouriteCount}</>
            )}. Last checked {club.lastChecked}.
          </blockquote>
          {club.n >= 50 && (
            <CalibrationChart
              bins={club.bins}
              caption={`Club-season calibration: ${club.n} matches × 3 outcomes, expected calibration error ${(club.ece * 100).toFixed(1)}%. Updated with each site build.`}
            />
          )}
          {club.n < 50 && (
            <p>
              The calibration chart appears once 50 matches are on the record — with fewer, the bins
              are too noisy to be meaningful.
            </p>
          )}
        </>
      )}

      {club.n === 0 && (
        <>
          <h2>Club-season record begins in August 2026</h2>
          <p>
            Since the season hasn&apos;t kicked off, there are no club results to score yet. The
            pipeline is already running: every daily{" "}
            <Link href="/snapshots/">forecast snapshot</Link> locks the match probabilities that are
            public before kickoff, and finished results are scored against them automatically. This
            section fills in from the first completed match.
          </p>
        </>
      )}

      <h2>Where the model comes from — World Cup 2026</h2>
      <blockquote>
        The same engine (Elo → Dixon-Coles → Monte Carlo) ran the 2026 World Cup as an{" "}
        <a href="https://github.com/Hicruben/world-cup-2026-prediction-model">open-source model</a>:{" "}
        <b>70 correct top picks from 102 completed matches</b>, with every prediction published
        before kickoff. When it picked a team and the match was drawn, that counted as incorrect.
      </blockquote>

      {bt && (
        <>
          <h3>The honest backtest: walk-forward on {bt.totalMatches} real internationals</h3>
          <p>
            Before the tournament, the model was tested the strict way — <b>out-of-sample</b>: each
            match predicted using only data available before kickoff, then scored against the actual
            result with proper scoring rules, not just accuracy. {bt.evaluated} matches evaluated
            ({bt.burnIn} burn-in). Reproduce it yourself with <code>node backtest.mjs</code> in the
            repository, or download the{" "}
            <a href="/data/wc-backtest.json" download>raw evaluation data</a>.
          </p>
          <div className="panel tight" style={{ margin: "18px 0" }}>
            <table className="data">
              <thead>
                <tr><th>Metric</th><th className="r">Model</th><th className="r">Baseline</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ranked Probability Score (↓)</td>
                  <td className="num r"><b>{f3(bt.model.rps)}</b></td>
                  <td className="num r">coin-flip {f3(bt.baselines.uniformRps)}</td>
                </tr>
                <tr>
                  <td>Brier score (↓)</td>
                  <td className="num r"><b>{f3(bt.model.brier)}</b></td>
                  <td className="num r">coin-flip {f3(bt.baselines.uniformBrier)}</td>
                </tr>
                <tr>
                  <td>Log-loss (↓)</td>
                  <td className="num r"><b>{f3(bt.model.logloss)}</b></td>
                  <td className="num r">coin-flip {f3(bt.baselines.uniformLogloss)}</td>
                </tr>
                <tr>
                  <td>Expected Calibration Error (↓)</td>
                  <td className="num r"><b>{(bt.model.ece * 100).toFixed(1)}%</b></td>
                  <td className="num r">&lt;5% = well-calibrated</td>
                </tr>
                <tr>
                  <td>Correct result (win/draw/loss)</td>
                  <td className="num r"><b>{pct(bt.model.accuracy)}</b></td>
                  <td className="num r">always-home {pct(bt.baselines.alwaysHome)}</td>
                </tr>
                <tr>
                  <td>When a clear favourite (p ≥ 50%)</td>
                  <td className="num r"><b>{pct(bt.model.favouriteAccuracy)}</b></td>
                  <td className="num r">{bt.model.favouriteCount} matches</td>
                </tr>
              </tbody>
            </table>
          </div>
          <CalibrationChart
            bins={bt.calibration.bins}
            caption={`Backtest calibration: ${bt.evaluated} internationals × 3 outcomes pooled into 10 bins. When the model said 30%, it happened about 30% of the time.`}
          />
        </>
      )}

      <p style={{ marginTop: 28 }}>
        Past results show how the model behaved; they do not guarantee future accuracy. New to
        probability? <Link href="/guide/">Read the beginner&apos;s guide</Link> before judging a
        single result — a prediction can be reasonable and still be wrong.
      </p>
    </main>
  );
}
