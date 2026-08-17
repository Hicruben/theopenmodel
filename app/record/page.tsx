import Link from "next/link";
import { wcBacktest, clubBacktest, clubRecord } from "@/lib/record";
import { CalibrationChart } from "../components/CalibrationChart";
import { NewsletterSignup } from "../components/NewsletterSignup";
import { pct } from "@/lib/ui";

export const metadata = {
  title: "Past predictions and results — checking our work",
  description:
    "The model's public track record: walk-forward backtest on 913 internationals, World Cup 2026 results, calibration charts and the live 2026-27 club-season record. Right and wrong both stay visible.",
};

const f3 = (x: number) => x.toFixed(3);

export default function Record() {
  const bt = wcBacktest();
  const cbt = clubBacktest();
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

      {cbt && (
        <>
          <h2>How good are these predictions, really?</h2>
          <p>
            The live record above is only a few matches old, so here is the same model measured
            over <b>{cbt.evaluated.toLocaleString()} completed matches</b> across three seasons of
            the same five leagues. Every match was predicted from each club&apos;s rating as it
            stood <i>before</i> kickoff, then scored against the result.
          </p>

          <div className="panel tight" style={{ margin: "18px 0" }}>
            <table className="data">
              <thead>
                <tr><th>Picking the most likely result</th><th className="r">Correct</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Always pick the home team</td>
                  <td className="num r">{pct(cbt.baselines.alwaysHome)}</td>
                </tr>
                <tr>
                  <td><b>This model</b></td>
                  <td className="num r"><b>{pct(cbt.model.accuracy)}</b></td>
                </tr>
                <tr>
                  <td>The betting market (closing odds)</td>
                  <td className="num r">{pct(cbt.market.accuracy)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            <b>The betting market is the ceiling, and it is 54%.</b> That is every bookmaker, every
            tipster and every pound of real money combined — and it still gets barely half of
            matches right. Football is not very predictable: about a quarter of matches end level,
            and a draw is almost never any forecaster&apos;s single most likely outcome. In{" "}
            {cbt.market.matches.toLocaleString()} matches the market named the draw as most likely{" "}
            <b>{cbt.market.drawWasFavourite} times</b>. So roughly one match in four is, in practice,
            unpredictable by anyone.
          </p>
          <p>
            Against that, this model sits {Math.round((cbt.model.accuracy - cbt.baselines.alwaysHome) * 100)} points above
            simply backing the home side, and {Math.round((cbt.market.accuracy - cbt.model.accuracy) * 100)} points below
            the market. If you want the most accurate forecast in the world, the market is it — and
            it is free to look at. What this site offers instead is the next paragraph.
          </p>

          <h3>The number that actually matters: do the percentages mean anything?</h3>
          <p>
            A forecast is only useful if its numbers are literal. When this model says 30%, that
            should happen about 30 times in 100 — otherwise the figure beside a match is decoration.
            Measured across those {cbt.evaluated.toLocaleString()} matches, the average gap between
            what the model said and what happened is <b>{(cbt.model.ece * 100).toFixed(2)} percentage
            points</b>. The betting market&apos;s gap, on the same seasons, is{" "}
            {(cbt.market.ece * 100).toFixed(2)} points.
          </p>
          <blockquote>
            <b>This model is less accurate than the bookmakers and better calibrated than them.</b>{" "}
            It will not tell you who wins more often than they will. It will tell you the truth about
            how sure it is — which is the part you can actually use, and the part nobody selling
            betting tips has any reason to get right.
          </blockquote>
          <CalibrationChart
            bins={cbt.calibration.bins}
            caption={`Club backtest calibration: ${cbt.evaluated.toLocaleString()} matches × 3 outcomes across ${cbt.seasons.join(", ")}. Each bar compares what the model said with how often it happened.`}
          />

          <h3>Things we tried that did not make it in</h3>
          <p>
            Accuracy could be pushed a little higher. We measured three ways of doing it and shipped
            none of them; the reasons matter more than the results.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="data">
              <thead>
                <tr><th>Idea</th><th>What happened</th><th>Why it isn&apos;t live</th></tr>
              </thead>
              <tbody>
                {cbt.experiments.map((e) => (
                  <tr key={e.name}>
                    <td style={{ whiteSpace: "nowrap" }}><b>{e.name}</b></td>
                    <td style={{ fontSize: 13, color: "var(--ink-soft)" }}>{e.result}</td>
                    <td style={{ fontSize: 13, color: "var(--ink-soft)" }}>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="foot-src">
            {cbt.method} Market figures: {cbt.market.source}.
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

      <div style={{ marginTop: 28 }}>
        <NewsletterSignup
          source="record"
          title="Follow the record as it fills in"
          blurb="Every Tuesday the model's week in one email: the biggest probability swing, one chart, and the prediction it got most wrong. The misses are the point — that is how you tell whether any of this is honest."
        />
      </div>

      <p style={{ marginTop: 28 }}>
        Past results show how the model behaved; they do not guarantee future accuracy. New to
        probability? <Link href="/guide/">Read the beginner&apos;s guide</Link> before judging a
        single result — a prediction can be reasonable and still be wrong.
      </p>
    </main>
  );
}
