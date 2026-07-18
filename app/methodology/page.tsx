import Link from "next/link";

export const metadata = {
  title: "Technical methodology — how the calculations work",
  description: "The technical details behind team-strength ratings, simulated goals and match-result probabilities.",
};

export default function Methodology() {
  return (
    <main className="wrap prose">
      <section className="hero">
        <span className="eyebrow">Technical detail</span>
        <h1>Technical methodology</h1>
        <p className="dek">
          This page contains formulas and statistical terms. For a plain-language introduction, start
          with <Link href="/guide/">how football predictions work</Link>.
        </p>
      </section>

      <h2><span className="idx">01</span>Ratings: Elo</h2>
      <p>
        <b>In plain English:</b> each club gets a running strength score based on its results.{" "}
        Club strength comes from <a href="http://clubelo.com">ClubElo</a> — continuously updated Elo
        ratings for European club football. For internationals we maintain our own Elo (K=60,
        goal-difference weighted). Elo is simple, hard to overfit, and its errors are well understood.
      </p>

      <h2><span className="idx">02</span>Goals: Dixon-Coles bivariate Poisson</h2>
      <p>
        <b>In plain English:</b> the strength difference becomes an average simulated goal total for
        each team, then the model tests possible scores. This is not shot-by-shot live-match xG.{" "}
        The Elo difference maps to expected goals for each side (λ = 1.35 + diff/400, clamped to
        [0.3, 3.5]), with a +65 Elo home advantage. Scorelines follow a bivariate Poisson with the
        Dixon-Coles τ correction (ρ = −0.13), which fixes vanilla Poisson&apos;s known under-prediction
        of 0-0 and 1-1 draws. Reference: Dixon &amp; Coles (1997), <i>Modelling Association Football
        Scores</i>.
      </p>

      <h2><span className="idx">03</span>Outcomes</h2>
      <p>
        <b>In plain English:</b> every possible score is grouped into a home win, draw or away win, and
        those three chances add to 100%. Summing the scoreline grid gives 1X2 probabilities. For tournaments we run 50,000 Monte Carlo
        simulations over the full bracket; for leagues, over the remaining fixture list.
      </p>

      <h2>Validation</h2>
      <blockquote>
        The separate international model was tested on 913 matches from October 2023 to June 2026,
        using only information available before each match. In its live World Cup record through
        15 July 2026, <b>70 of 102 top picks were correct</b>. The club model begins its own public
        results history with the 2026–27 league season.
      </blockquote>
      <p>
        The international model code, backtest and match record are available in the{" "}
        <a href="https://github.com/Hicruben/world-cup-2026-prediction-model">public World Cup repository</a>.
      </p>

      <h2>What we don&apos;t do</h2>
      <p>
        No scraped bookmaker odds, no LLM guessing, no retroactive edits. A prediction that turned out
        wrong stays on the record. Probabilities are statements of frequency, not certainty — a 25%
        underdog wins one time in four, and this tournament kept proving it. Pre-season league sims
        are a pure-Elo baseline: they assume today&apos;s strength holds all season, so favorites read
        high until real results start updating the ratings.
      </p>
    </main>
  );
}
