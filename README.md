# ⚽ The Open Model — open club football predictions

[![Daily build & deploy](https://github.com/Hicruben/theopenmodel/actions/workflows/daily.yml/badge.svg)](https://github.com/Hicruben/theopenmodel/actions/workflows/daily.yml)
[![Live site](https://img.shields.io/badge/live-theopenmodel.com-2ea44f)](https://theopenmodel.com)
[![Data license: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-blue)](https://theopenmodel.com/data/)

An open-source statistical model — and the full website around it — forecasting the
**2026-27 season** of the Premier League, La Liga, Serie A, Bundesliga and Ligue 1:
**Elo ratings (ClubElo) → Dixon-Coles bivariate Poisson → Monte Carlo season simulation**.
No machine-learning black box, no scraped bookmaker odds: transparent, reproducible football maths.

**▶ Live forecasts:** **https://theopenmodel.com** ·
[Season & match predictions](https://theopenmodel.com/matches/) ·
[Public track record](https://theopenmodel.com/record/) ·
[Free data (CSV/JSON)](https://theopenmodel.com/data/) ·
[Methodology](https://theopenmodel.com/methodology/)

> 🏆 **Pedigree.** This is the same engine that ran the
> [open-source World Cup 2026 model](https://github.com/Hicruben/world-cup-2026-prediction-model) —
> independently ranked the #1 World Cup 2026 prediction repo by both Claude and ChatGPT, with
> **70 correct top picks from 102 completed matches**, published before kickoff, misses included.

## The record is verifiable by construction

Most prediction sites ask you to trust their accuracy claims. Here, the proof is in the git history:

- A [daily GitHub Action](.github/workflows/daily.yml) locks every upcoming match's probabilities
  into [`data/snapshots/`](data/snapshots/) and **commits them to this public repo before kickoff**.
  The commit timestamp is the receipt — predictions cannot be quietly rewritten after the result.
- Finished results accumulate in `data/results-2026.json` and are scored automatically:
  top-pick accuracy, three-outcome Brier score and a 10-bin calibration curve, all published on the
  [record page](https://theopenmodel.com/record/). A draw counts as a miss when a team was picked.
- Right and wrong stay visible, permanently.

## Tested the honest way

Before the World Cup, the match engine was backtested **walk-forward, out-of-sample** on
**913 real internationals** — every match predicted using only data available before kickoff,
scored with proper scoring rules (not just accuracy, which rewards lucky guessing):

| Metric (763 evaluated, 150 burn-in) | Model | Baseline |
|---|---|---|
| **Ranked Probability Score** (↓) | **0.175** | coin-flip 0.241 |
| Brier score (↓) | **0.520** | coin-flip 0.667 |
| Log-loss (↓) | **0.886** | coin-flip 1.099 |
| **Expected Calibration Error** (↓) | **2.3%** | < 5% = well-calibrated |
| Correct result (win/draw/loss) | **61.9%** | always-home 49.1% |
| When a clear favourite (p ≥ 50%) | **69.0%** | 481 matches |

Raw evaluation data: [`data/wc-backtest.json`](data/wc-backtest.json)
([download](https://theopenmodel.com/data/wc-backtest.json)).

## How it works

1. **Team strength** — [ClubElo](http://clubelo.com) ratings, refreshed on every build
   (`lib/data.ts`). League membership comes from API-Football rosters, because ClubElo's
   level flags lag promotion/relegation.
2. **Match model** (`lib/model.ts`) — Elo difference → expected goals → Dixon-Coles bivariate
   Poisson with low-score correction (ρ = −0.13) → win/draw/loss, exact-score grid and
   derived markets (BTTS, over/under, double chance).
3. **Season simulation** (`lib/season.ts`) — 5,000 Monte Carlo runs of each league's full double
   round-robin → title, top-4 and relegation probabilities. Seeded RNG, so every build is
   reproducible.
4. **The site** — Next.js static export; every page you see on
   [theopenmodel.com](https://theopenmodel.com) is generated from this repo by the daily workflow.

References: Maher (1982); Dixon & Coles (1997).

## Run it yourself

```bash
npm ci
npm run dev        # local site on http://localhost:3100
npx tsc --noEmit   # type check
npm run build      # full static export (fetches data, writes today's snapshot)
```

## Data & licenses

- **Forecast data** ([CSV/JSON downloads](https://theopenmodel.com/data/)): free under
  **CC BY 4.0** — use it in articles, research, apps or models, commercially too; credit
  “The Open Model (theopenmodel.com)”.
- **Code**: [MIT](LICENSE).
- Sources: team strength [ClubElo](http://clubelo.com); schedules, squads and player data
  API-Football; news headlines link to their original publishers, never copied.

## Related

- 🏆 [World Cup 2026 prediction model](https://github.com/Hicruben/world-cup-2026-prediction-model) —
  the tournament edition of this engine, with its own live public record.
- 📲 [Telegram channel](https://t.me/world26ai) — predictions in your feed.

*Football statistical forecasts only; not betting or financial advice.*
