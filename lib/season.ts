// Season Monte Carlo: simulate a full double round-robin league season from current Elo
// (5,000 runs) → title / top-4 / relegation probabilities per club.
// This is the flagship "open model" product page — no fixture list needed pre-season:
// a double round-robin is fully defined by the club list.
import { ClubRow } from "./data";
import { expectedGoals, HOME_ADV_CLUB } from "./model";

// deterministic RNG (mulberry32) so builds are reproducible
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

export interface SeasonOdds {
  slug: string;
  club: string;
  elo: number;
  title: number;     // P(1st)
  top4: number;      // P(top 4)
  releg: number;     // P(bottom 3)
  avgPts: number;
}

export function simulateSeason(clubs: ClubRow[], sims = 5000, seed = 26): SeasonOdds[] {
  const n = clubs.length;
  const rng = mulberry32(seed);
  const titleCt = new Array(n).fill(0);
  const top4Ct = new Array(n).fill(0);
  const relegCt = new Array(n).fill(0);
  const ptsSum = new Array(n).fill(0);

  // precompute λ for every ordered pair (home i vs away j)
  const lamH: number[][] = [], lamA: number[][] = [];
  for (let i = 0; i < n; i++) {
    lamH[i] = []; lamA[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) { lamH[i][j] = 0; lamA[i][j] = 0; continue; }
      lamH[i][j] = expectedGoals(clubs[i].elo, clubs[j].elo, HOME_ADV_CLUB);
      lamA[i][j] = expectedGoals(clubs[j].elo, clubs[i].elo, -HOME_ADV_CLUB / 2);
    }
  }

  const pts = new Array(n);
  const order = new Array(n);
  for (let s = 0; s < sims; s++) {
    pts.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const gh = poisson(lamH[i][j], rng);
        const ga = poisson(lamA[i][j], rng);
        if (gh > ga) pts[i] += 3;
        else if (gh < ga) pts[j] += 3;
        else { pts[i] += 1; pts[j] += 1; }
      }
    }
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((x: number, y: number) => pts[y] - pts[x] || rng() - 0.5);
    titleCt[order[0]]++;
    for (let k = 0; k < 4; k++) top4Ct[order[k]]++;
    for (let k = n - 3; k < n; k++) relegCt[order[k]]++;
    for (let i = 0; i < n; i++) ptsSum[i] += pts[i];
  }

  return clubs.map((c, i) => ({
    slug: c.slug,
    club: c.club,
    elo: c.elo,
    title: titleCt[i] / sims,
    top4: top4Ct[i] / sims,
    releg: relegCt[i] / sims,
    avgPts: ptsSum[i] / sims,
  })).sort((a, b) => b.avgPts - a.avgPts);
}

// build-time cache so 5 leagues × 5k sims runs once per build
const cache = new Map<string, SeasonOdds[]>();
export function seasonOdds(leagueSlug: string, clubs: ClubRow[]): SeasonOdds[] {
  if (!cache.has(leagueSlug)) cache.set(leagueSlug, simulateSeason(clubs));
  return cache.get(leagueSlug)!;
}
