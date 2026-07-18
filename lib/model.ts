// The Open Model — core match model.
// Elo ratings (ClubElo) → Dixon-Coles bivariate Poisson → 1X2 probabilities.
// Ported from the World Cup 2026 model (walk-forward backtested on 913 internationals,
// The related international model has a separately maintained public World Cup record.
// References: Maher (1982); Dixon & Coles (1997).

export const DC_RHO = -0.13;          // Dixon-Coles low-score correction (empirical fit)
export const HOME_ADV_CLUB = 65;      // ClubElo-style home advantage in Elo points

function dcTau(a: number, b: number, lambda: number, mu: number, rho: number): number {
  if (a === 0 && b === 0) return 1 - lambda * mu * rho;
  if (a === 0 && b === 1) return 1 + lambda * rho;
  if (a === 1 && b === 0) return 1 + mu * rho;
  if (a === 1 && b === 1) return 1 - rho;
  return 1;
}

export function expectedScore(ratingA: number, ratingB: number, homeBonusA = 0): number {
  return 1 / (1 + Math.pow(10, (ratingB - (ratingA + homeBonusA)) / 400));
}

// Elo difference → expected goals (Poisson λ). The 400 denominator is calibrated on the
// international backtest (see /methodology); club football shares the same shape.
export function expectedGoals(rating: number, opponent: number, homeBonus = 0): number {
  const diff = (rating + homeBonus) - opponent;
  const lambda = 1.35 + diff / 400;
  return Math.max(0.3, Math.min(3.5, lambda));
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export interface MatchProb {
  home: number;
  draw: number;
  away: number;
  xgHome: number;
  xgAway: number;
}

// Full scoreline probability grid (0-5+ each side) — the match-page heatmap.
export interface ScoreCell { h: number; a: number; p: number }
export function scoreGrid(eloHome: number, eloAway: number, homeAdv = HOME_ADV_CLUB): {
  grid: number[][];        // [home 0..5][away 0..5], 5 = "5+" bucket
  top: ScoreCell[];        // most likely exact scores, desc
} {
  const lambda = expectedGoals(eloHome, eloAway, homeAdv);
  const mu = expectedGoals(eloAway, eloHome, -homeAdv / 2);
  const raw: number[][] = [];
  let total = 0;
  for (let a = 0; a <= 8; a++) {
    raw[a] = [];
    for (let b = 0; b <= 8; b++) {
      const p = poissonPmf(a, lambda) * poissonPmf(b, mu) * dcTau(a, b, lambda, mu, DC_RHO);
      raw[a][b] = p;
      total += p;
    }
  }
  const grid: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));
  for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
    grid[Math.min(a, 5)][Math.min(b, 5)] += raw[a][b] / total;
  }
  const top: ScoreCell[] = [];
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) top.push({ h: a, a: b, p: grid[a][b] });
  top.sort((x, y) => y.p - x.p);
  return { grid, top };
}

// Derived betting-market probabilities from the scoreline grid.
export interface MarketProbs {
  btts: number;        // both teams to score
  over15: number; over25: number; over35: number;
  homeCleanSheet: number; awayCleanSheet: number;
  dc1x: number; dcx2: number; dc12: number;   // double chance
}
export function marketProbs(eloHome: number, eloAway: number, homeAdv = HOME_ADV_CLUB): MarketProbs {
  const { grid } = scoreGrid(eloHome, eloAway, homeAdv);
  const p = matchProb(eloHome, eloAway, homeAdv);
  let btts = 0, o15 = 0, o25 = 0, o35 = 0, hcs = 0, acs = 0;
  for (let h = 0; h <= 5; h++) for (let a = 0; a <= 5; a++) {
    const v = grid[h][a];
    if (h >= 1 && a >= 1) btts += v;
    if (h + a >= 2) o15 += v;
    if (h + a >= 3) o25 += v;
    if (h + a >= 4) o35 += v;
    if (a === 0) hcs += v;
    if (h === 0) acs += v;
  }
  return {
    btts, over15: o15, over25: o25, over35: o35,
    homeCleanSheet: hcs, awayCleanSheet: acs,
    dc1x: p.home + p.draw, dcx2: p.draw + p.away, dc12: p.home + p.away,
  };
}

// 1X2 probabilities via Dixon-Coles bivariate Poisson (0-8 goals each side).
export function matchProb(eloHome: number, eloAway: number, homeAdv = HOME_ADV_CLUB): MatchProb {
  const lambda = expectedGoals(eloHome, eloAway, homeAdv);
  const mu = expectedGoals(eloAway, eloHome, -homeAdv / 2);
  let home = 0, draw = 0, away = 0;
  for (let a = 0; a <= 8; a++) {
    const pA = poissonPmf(a, lambda);
    for (let b = 0; b <= 8; b++) {
      const tau = dcTau(a, b, lambda, mu, DC_RHO);
      const p = pA * poissonPmf(b, mu) * tau;
      if (a > b) home += p;
      else if (a < b) away += p;
      else draw += p;
    }
  }
  const total = home + draw + away;
  return {
    home: home / total,
    draw: draw / total,
    away: away / total,
    xgHome: lambda,
    xgAway: mu,
  };
}
