// Keep team strengths moving when the ratings provider stalls.
//
// ClubElo is the base rating and stays the base: measured over three seasons, advancing
// ratings ourselves for a whole year costs about 0.6 points of accuracy, so replacing it
// would be a downgrade. But at the start of 2026-27 it stopped processing results — three
// days of matches, twenty-four La Liga clubs, not one rating change — while still rolling
// each club's validity window forward, so the file looked current and every projection on
// the site was frozen.
//
// This fills that gap and only that gap: results ClubElo has already priced in are left
// alone, and results it hasn't seen are applied with a standard Elo step. When ClubElo is
// up to date this returns its numbers untouched.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface EloAdjustment {
  /** Rating after applying results the provider hasn't processed. */
  elo: number;
  /** How far that is from the provider's own number. */
  delta: number;
  /** Matches we applied ourselves. */
  applied: number;
}

interface Result { id: number; date: string; league: string; home: string; away: string; hg: number; ag: number }

const HOME_ADV = 65;
const K = 20;                 // best of the swept values; larger over-reacts, smaller lags

// A 3-0 says more about a side than a 1-0, and ignoring that makes the correction too
// sluggish to be worth applying at all.
const gdMultiplier = (gd: number) => (gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8);

function loadResults(): Result[] {
  const p = join(process.cwd(), "data", "results-2026.json");
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return (Object.values(raw.results ?? {}) as Result[]).sort((a, b) => a.date.localeCompare(b.date));
  } catch { return []; }
}

// The last date on which the provider's numbers actually moved — not the last date it
// stamped on a file. Its validity windows advance at every fixture whether or not the
// result behind them has been priced in, so the dates alone cannot tell you that.
function providerLastMoved(): string | null {
  const dir = join(process.cwd(), "data", "elo-history");
  if (!existsSync(dir)) return null;
  let newest: string | null = null;
  let files: string[] = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith(".csv")); } catch { return null; }
  for (const f of files) {
    let prev: number | null = null;
    let last: string | null = null;
    for (const line of readFileSync(join(dir, f), "utf8").trim().split("\n").slice(1)) {
      const c = line.split(",");
      const elo = Number(c[4]), date = c[5];
      if (!date || !Number.isFinite(elo)) continue;
      if (prev != null && Math.abs(elo - prev) >= 0.5) last = date;
      prev = elo;
    }
    if (last && (!newest || last > newest)) newest = last;
  }
  return newest;
}

/**
 * Ratings for every club, with any results the provider has not yet processed applied on
 * top. Keyed by club name as it appears in the ratings file.
 */
export function liveElo(base: Map<string, number>): Map<string, EloAdjustment> {
  const out = new Map<string, EloAdjustment>();
  for (const [club, elo] of base) out.set(club, { elo, delta: 0, applied: 0 });

  const cutoff = providerLastMoved();
  if (!cutoff) return out;

  // Only matches finished after the provider last moved anything. Anything earlier is
  // already in its numbers, and applying it again would double-count the result.
  const pending = loadResults().filter((r) => r.date.slice(0, 10) > cutoff);
  if (!pending.length) return out;

  for (const m of pending) {
    const h = out.get(m.home), a = out.get(m.away);
    if (!h || !a) continue;                    // a club we don't rate; skip rather than guess
    const expH = 1 / (1 + Math.pow(10, (a.elo - (h.elo + HOME_ADV)) / 400));
    const actH = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0;
    const shift = K * gdMultiplier(Math.abs(m.hg - m.ag)) * (actH - expH);
    h.elo += shift; h.delta += shift; h.applied++;
    a.elo -= shift; a.delta -= shift; a.applied++;
  }
  return out;
}

/** Whether any correction is currently in force, for the note shown on the site. */
export function eloGapInfo(adjustments: Map<string, EloAdjustment>): { applied: number; clubs: number } {
  let applied = 0, clubs = 0;
  for (const a of adjustments.values()) {
    if (a.applied > 0) { clubs++; applied = Math.max(applied, a.applied); }
  }
  return { applied, clubs };
}
