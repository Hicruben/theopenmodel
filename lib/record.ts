// Public track record: (a) the World Cup 2026 model's walk-forward backtest (pedigree,
// data/wc-backtest.json, produced by the open-source repo's backtest.mjs); (b) the live
// club-season record — daily snapshots lock match probabilities before kickoff
// (data/snapshots/*.json `matches`), results accumulate in data/results-2026.json,
// and this module joins the two. Same policy as the World Cup model: the top pick is
// scored against the final result; a draw counts as a miss when a team was picked.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { allFixtures } from "./fixtures";

export interface CalibBin {
  range: [number, number];
  n: number;
  avgPred: number;
  obsFreq: number;
}

export interface WcBacktest {
  generatedAt: string;
  method: string;
  totalMatches: number;
  evaluated: number;
  burnIn: number;
  model: {
    accuracy: number; brier: number; logloss: number; rps: number;
    ece: number; favouriteAccuracy: number; favouriteCount: number;
  };
  baselines: {
    alwaysHome: number; eloPickNoDraw: number;
    uniformBrier: number; uniformLogloss: number; uniformRps: number;
  };
  calibration: { bins: CalibBin[] };
}

export function wcBacktest(): WcBacktest | null {
  const p = join(process.cwd(), "data", "wc-backtest.json");
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

// ── club-season live record ─────────────────────────────────

export interface LockedPrediction {
  id: number;            // API-Football fixture id
  slug: string;
  league: string;
  date: string;          // ISO kickoff
  home: string;
  away: string;
  p: { h: number; d: number; a: number };
}

export interface MatchResult {
  id: number;
  date: string;
  league: string;
  home: string;
  away: string;
  hg: number;
  ag: number;
}

export interface ScoredMatch extends MatchResult {
  p: { h: number; d: number; a: number };
  lockedOn: string;      // snapshot date the prediction was locked
  pick: "home" | "draw" | "away";
  actual: "home" | "draw" | "away";
  correct: boolean;
}

export interface ClubRecord {
  matches: ScoredMatch[];
  n: number;
  hits: number;
  accuracy: number;
  brier: number;           // 3-outcome Brier, lower is better (uniform baseline 0.667)
  favouriteCount: number;  // picks with p >= 0.5
  favouriteHits: number;
  ece: number;
  bins: CalibBin[];
  lastChecked: string | null;
}

function loadResults(): MatchResult[] {
  const p = join(process.cwd(), "data", "results-2026.json");
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return Object.values(raw.results ?? {}) as MatchResult[];
  } catch { return []; }
}

interface SnapshotFile {
  date: string;
  generatedAt: string;
  matches?: LockedPrediction[];
}

// For every fixture id, the prediction from the LATEST snapshot generated strictly
// before kickoff — i.e. the numbers that were actually public when the match started.
//
// Kickoff times come from the current fixture list rather than the copy embedded in the
// snapshot. A snapshot is a point-in-time artefact and is never rewritten (it is the
// evidence), so its kickoff times can be stale — La Liga's opening round was published
// with placeholder times before the real schedule arrived. The current schedule is the
// authority both for what we publish and for deciding whether a prediction really did
// precede its match.
function lockedPredictions(): Map<number, { pred: LockedPrediction; lockedOn: string }> {
  const dir = join(process.cwd(), "data", "snapshots");
  const kickoffs = new Map(allFixtures().map((f) => [f.id, f.date]));
  const locked = new Map<number, { pred: LockedPrediction; lockedOn: string; generatedAt: string }>();
  let files: string[] = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort(); } catch { return new Map(); }
  for (const f of files) {
    let snap: SnapshotFile;
    try { snap = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch { continue; }
    if (!Array.isArray(snap.matches)) continue;
    for (const m of snap.matches) {
      const kickoff = kickoffs.get(m.id) ?? m.date;
      if (snap.generatedAt >= kickoff) continue;         // snapshot after kickoff: not a pre-match prediction
      const prev = locked.get(m.id);
      if (!prev || snap.generatedAt > prev.generatedAt) {
        locked.set(m.id, { pred: { ...m, date: kickoff }, lockedOn: snap.date, generatedAt: snap.generatedAt });
      }
    }
  }
  return new Map([...locked].map(([id, v]) => [id, { pred: v.pred, lockedOn: v.lockedOn }]));
}

// The full public ledger: every prediction that was locked before kickoff, with the
// result attached once it exists. Published as an open dataset so anyone can rescore
// the model themselves — the claim "we publish before kickoff and keep the misses" is
// only worth anything if the underlying rows are downloadable.
export interface LedgerRow {
  id: number;
  slug: string;
  league: string;
  date: string;             // ISO kickoff
  home: string;
  away: string;
  p: { h: number; d: number; a: number };
  lockedOn: string;         // snapshot date the prediction was published
  pick: "home" | "draw" | "away";
  hg: number | null;        // null until the match has been played
  ag: number | null;
  actual: "home" | "draw" | "away" | null;
  correct: boolean | null;
}

export function predictionLedger(): LedgerRow[] {
  const results = new Map(loadResults().map((r) => [r.id, r]));
  const rows: LedgerRow[] = [];
  for (const [id, { pred, lockedOn }] of lockedPredictions()) {
    const probs = { home: pred.p.h, draw: pred.p.d, away: pred.p.a };
    const pick = (Object.entries(probs) as ["home" | "draw" | "away", number][])
      .sort((a, b) => b[1] - a[1])[0][0];
    const r = results.get(id);
    const actual: "home" | "draw" | "away" | null =
      r ? (r.hg > r.ag ? "home" : r.hg < r.ag ? "away" : "draw") : null;
    rows.push({
      id, slug: pred.slug, league: pred.league, date: pred.date,
      home: pred.home, away: pred.away, p: pred.p, lockedOn, pick,
      hg: r?.hg ?? null, ag: r?.ag ?? null,
      actual, correct: actual ? pick === actual : null,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

const BINS = 10;

export function clubRecord(): ClubRecord {
  const locked = lockedPredictions();
  const results = loadResults();
  const matches: ScoredMatch[] = [];

  for (const r of results) {
    const lock = locked.get(r.id);
    if (!lock) continue;
    const probs = { home: lock.pred.p.h, draw: lock.pred.p.d, away: lock.pred.p.a };
    const pick = (Object.entries(probs) as ["home" | "draw" | "away", number][])
      .sort((a, b) => b[1] - a[1])[0][0];
    const actual: "home" | "draw" | "away" = r.hg > r.ag ? "home" : r.hg < r.ag ? "away" : "draw";
    matches.push({ ...r, p: lock.pred.p, lockedOn: lock.lockedOn, pick, actual, correct: pick === actual });
  }
  matches.sort((a, b) => a.date.localeCompare(b.date));

  const bins: { sumP: number; sumY: number; n: number }[] =
    Array.from({ length: BINS }, () => ({ sumP: 0, sumY: 0, n: 0 }));
  let brier = 0, favouriteCount = 0, favouriteHits = 0;
  for (const m of matches) {
    const probs = [m.p.h, m.p.d, m.p.a];
    const y = [m.actual === "home" ? 1 : 0, m.actual === "draw" ? 1 : 0, m.actual === "away" ? 1 : 0];
    for (let k = 0; k < 3; k++) {
      brier += (probs[k] - y[k]) ** 2;
      const b = Math.min(BINS - 1, Math.floor(probs[k] * BINS));
      bins[b].sumP += probs[k]; bins[b].sumY += y[k]; bins[b].n++;
    }
    const top = Math.max(...probs);
    if (top >= 0.5) { favouriteCount++; if (m.correct) favouriteHits++; }
  }
  const n = matches.length;
  const total = bins.reduce((s, b) => s + b.n, 0);
  const outBins: CalibBin[] = bins.map((b, i) => ({
    range: [i / BINS, (i + 1) / BINS],
    n: b.n,
    avgPred: b.n ? b.sumP / b.n : 0,
    obsFreq: b.n ? b.sumY / b.n : 0,
  }));
  const ece = total
    ? outBins.reduce((s, b) => s + (b.n / total) * Math.abs(b.avgPred - b.obsFreq), 0)
    : 0;

  return {
    matches,
    n,
    hits: matches.filter((m) => m.correct).length,
    accuracy: n ? matches.filter((m) => m.correct).length / n : 0,
    brier: n ? brier / n : 0,
    favouriteCount,
    favouriteHits,
    ece,
    bins: outBins,
    lastChecked: n ? matches[matches.length - 1].date.slice(0, 10) : null,
  };
}
