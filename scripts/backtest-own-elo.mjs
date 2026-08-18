#!/usr/bin/env node
// Can this model keep its own ratings up to date, instead of waiting for ClubElo?
//
// Every projection on the site is built from ClubElo's team strengths, and at the start of
// 2026-27 those stopped moving: three days of matches, twenty-four La Liga clubs, not one
// rating change. ClubElo rolls each club's validity window forward regardless, so the file
// looked fresh while the numbers were a month old — and with frozen strengths nothing on
// the site can change, which is the whole promise of a daily projection.
//
// The fix would be to anchor on ClubElo once and then advance the ratings ourselves from
// results we already have. That removes a supplier who can freeze us — the failure mode
// that just gutted FBref — but it replaces a well-tuned rating system with our own, so it
// has to be measured before it is trusted.
//
// The experiment: freeze ClubElo at the start of a season, run our own updates through it,
// and score the resulting predictions against those made with ClubElo's real live ratings
// over exactly the same matches.
//
//   node scripts/backtest-own-elo.mjs
//   node scripts/backtest-own-elo.mjs --sweep
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const CACHE = join(process.cwd(), "data", ".backtest-cache");
const SWEEP = process.argv.includes("--sweep");
const SEASONS = [2023, 2024, 2025];
const LEAGUES = [
  { slug: "premier-league", id: 39 },
  { slug: "la-liga", id: 140 },
  { slug: "serie-a", id: 135 },
  { slug: "bundesliga", id: 78 },
  { slug: "ligue-1", id: 61 },
];
const ELO = { base: 1.35, homeAdv: 65, rho: -0.13, denom: 400 };

// ── model ───────────────────────────────────────────────────
function dcTau(a, b, l, m, rho) {
  if (a === 0 && b === 0) return 1 - l * m * rho;
  if (a === 0 && b === 1) return 1 + l * rho;
  if (a === 1 && b === 0) return 1 + m * rho;
  if (a === 1 && b === 1) return 1 - rho;
  return 1;
}
function poissonPmf(k, l) { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; }
const clamp = (x) => Math.max(0.3, Math.min(3.5, x));
function probs(eloHome, eloAway) {
  const l = clamp(ELO.base + ((eloHome + ELO.homeAdv) - eloAway) / ELO.denom);
  const m = clamp(ELO.base + (eloAway - (eloHome + ELO.homeAdv)) / ELO.denom);
  let h = 0, d = 0, a = 0;
  for (let x = 0; x <= 10; x++) {
    const pA = poissonPmf(x, l);
    for (let y = 0; y <= 10; y++) {
      const p = pA * poissonPmf(y, m) * dcTau(x, y, l, m, ELO.rho);
      if (x > y) h += p; else if (x === y) d += p; else a += p;
    }
  }
  const s = h + d + a;
  return [h / s, d / s, a / s];
}

// ── our own Elo step ────────────────────────────────────────
// Standard Elo, with the goal-difference multiplier football ratings use: a 3-0 says more
// about a side than a 1-0, and ignoring that makes the ratings react too slowly to be
// worth computing ourselves.
function gdMultiplier(gd) {
  if (gd <= 1) return 1;
  if (gd === 2) return 1.5;
  return (11 + gd) / 8;
}
function eloStep(home, away, hg, ag, { k, homeAdv }) {
  const expH = 1 / (1 + Math.pow(10, (away - (home + homeAdv)) / 400));
  const actH = hg > ag ? 1 : hg === ag ? 0.5 : 0;
  const delta = k * gdMultiplier(Math.abs(hg - ag)) * (actH - expH);
  return [home + delta, away - delta];
}

// ── ClubElo history: the live ratings we are trying to replace ──
const eloCache = new Map();
function series(slug) {
  if (!eloCache.has(slug)) {
    const p = join(process.cwd(), "data", "elo-history", `${slug}.csv`);
    eloCache.set(slug, existsSync(p)
      ? readFileSync(p, "utf8").trim().split("\n").slice(1).map((l) => {
          const c = l.split(","); return { date: c[5], elo: Number(c[4]) };
        }).filter((x) => x.date && x.elo > 0)
      : []);
  }
  return eloCache.get(slug);
}
function eloBefore(slug, date) {
  let found = null;
  for (const p of series(slug)) { if (p.date < date) found = p.elo; else break; }
  return found;
}

// ── load matches ────────────────────────────────────────────
const meta = JSON.parse(readFileSync(join(process.cwd(), "data", "leagues-2026.json"), "utf8"));
const byApiId = new Map();
for (const rows of Object.values(meta)) for (const c of rows) if (c.apiId) byApiId.set(c.apiId, c.slug);

const bySeason = new Map();
for (const season of SEASONS) {
  const list = [];
  for (const lg of LEAGUES) {
    const f = join(CACHE, `${lg.id}-${season}.json`);
    if (!existsSync(f)) continue;
    for (const r of JSON.parse(readFileSync(f, "utf8"))) {
      const hs = byApiId.get(r.homeId), as = byApiId.get(r.awayId);
      if (!hs || !as) continue;
      list.push({ ...r, hs, as, league: lg.slug });
    }
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  if (list.length) bySeason.set(season, list);
}

// ── run one season with our own ratings, anchored at its first match ──
function runSeason(list, params) {
  const anchorDate = list[0].date;
  const own = new Map();
  const rows = [];
  for (const m of list) {
    const liveH = eloBefore(m.hs, m.date), liveA = eloBefore(m.as, m.date);
    // Anchor each club once, on the ClubElo rating it carried into the season.
    if (!own.has(m.hs)) { const a = eloBefore(m.hs, anchorDate); if (a == null) continue; own.set(m.hs, a); }
    if (!own.has(m.as)) { const a = eloBefore(m.as, anchorDate); if (a == null) continue; own.set(m.as, a); }
    const ownH = own.get(m.hs), ownA = own.get(m.as);

    if (liveH != null && liveA != null) {
      rows.push({ m, live: probs(liveH, liveA), own: probs(ownH, ownA), drift: Math.abs(ownH - liveH) });
    }
    const [nh, na] = eloStep(ownH, ownA, m.hg, m.ag, params);
    own.set(m.hs, nh); own.set(m.as, na);
  }
  return rows;
}

function score(rows, pick) {
  let n = 0, hits = 0, brier = 0, logloss = 0;
  const bins = Array.from({ length: 10 }, () => ({ sumP: 0, sumY: 0, n: 0 }));
  for (const r of rows) {
    const p = pick(r);
    const actual = r.m.hg > r.m.ag ? 0 : r.m.hg === r.m.ag ? 1 : 2;
    n++;
    if (p.indexOf(Math.max(...p)) === actual) hits++;
    for (let k = 0; k < 3; k++) {
      const y = k === actual ? 1 : 0;
      brier += (p[k] - y) ** 2;
      const b = Math.min(9, Math.floor(p[k] * 10));
      bins[b].sumP += p[k]; bins[b].sumY += y; bins[b].n++;
    }
    logloss -= Math.log(Math.max(1e-12, p[actual]));
  }
  const total = bins.reduce((s, b) => s + b.n, 0);
  const ece = bins.reduce((s, b) => s + (b.n / total) * Math.abs((b.n ? b.sumP / b.n : 0) - (b.n ? b.sumY / b.n : 0)), 0);
  return { n, accuracy: hits / n, brier: brier / n, logloss: logloss / n, ece };
}

function evaluate(params) {
  const rows = [...bySeason.values()].flatMap((list) => runSeason(list, params));
  return {
    rows,
    live: score(rows, (r) => r.live),
    own: score(rows, (r) => r.own),
    drift: rows.reduce((s, r) => s + r.drift, 0) / rows.length,
  };
}

const show = (label, s) => console.log(
  `  ${label.padEnd(34)} acc ${(s.accuracy * 100).toFixed(2)}%  logloss ${s.logloss.toFixed(5)}  ` +
  `Brier ${s.brier.toFixed(5)}  ECE ${(s.ece * 100).toFixed(2)}%`);

const DEFAULT = { k: 20, homeAdv: 65 };
const base = evaluate(DEFAULT);
console.log(`\n${base.rows.length} matches across ${[...bySeason.keys()].join(", ")}\n`);
console.log(`── ClubElo's live ratings vs ratings we advance ourselves ──`);
show("ClubElo live (what we use now)", base.live);
show(`our own (K=${DEFAULT.k}, anchored per season)`, base.own);
console.log(`\n  average distance from ClubElo after drifting a whole season: ${base.drift.toFixed(1)} Elo points`);

if (SWEEP) {
  console.log("\n── sweeping our update rule (objective: log loss) ──");
  const out = [];
  for (const k of [8, 12, 16, 20, 24, 30, 40]) {
    for (const homeAdv of [45, 55, 65, 75, 85]) {
      const e = evaluate({ k, homeAdv });
      out.push({ k, homeAdv, s: e.own, drift: e.drift });
    }
  }
  out.sort((a, b) => a.s.logloss - b.s.logloss);
  for (const r of out.slice(0, 6)) show(`K=${r.k} homeAdv=${r.homeAdv} (drift ${r.drift.toFixed(0)})`, r.s);
  console.log("");
  show("ClubElo live (reference)", base.live);
}
