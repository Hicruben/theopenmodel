#!/usr/bin/env node
// Walk-forward backtest of the club model.
//
// The published 61.9% accuracy comes from the World Cup model's backtest on
// internationals. The club model reuses its constants — the goal baseline, the home
// advantage, the Dixon-Coles correction — on the assumption that "club football shares
// the same shape". That assumption has never been measured, so nobody knows how the club
// forecasts actually perform, and tuning them would be guesswork.
//
// This scores the model against completed seasons using only information that existed
// before each kickoff: a club's Elo is read from data/elo-history/ as of the day before
// the match, never after it. Optionally sweeps the constants to see whether club football
// wants different ones.
//
//   API_FOOTBALL_KEY=... node scripts/backtest-club.mjs                  # score as configured
//   API_FOOTBALL_KEY=... node scripts/backtest-club.mjs --sweep          # search better constants
//   ... --seasons 2023,2024,2025
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const KEY = process.env.API_FOOTBALL_KEY;
const BASE = "https://v3.football.api-sports.io";
const CACHE = join(process.cwd(), "data", ".backtest-cache");
const SWEEP = process.argv.includes("--sweep");
const seasonsArg = process.argv.indexOf("--seasons");
const SEASONS = seasonsArg > -1
  ? process.argv[seasonsArg + 1].split(",").map(Number)
  : [2023, 2024, 2025];

const LEAGUES = [
  { slug: "premier-league", id: 39 },
  { slug: "la-liga", id: 140 },
  { slug: "serie-a", id: 135 },
  { slug: "bundesliga", id: 78 },
  { slug: "ligue-1", id: 61 },
];

// ── model (mirrors lib/model.ts so constants can be varied) ──
function dcTau(a, b, lambda, mu, rho) {
  if (a === 0 && b === 0) return 1 - lambda * mu * rho;
  if (a === 0 && b === 1) return 1 + lambda * rho;
  if (a === 1 && b === 0) return 1 + mu * rho;
  if (a === 1 && b === 1) return 1 - rho;
  return 1;
}
function poissonPmf(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}
function matchProb(eloHome, eloAway, { base, homeAdv, rho, denom }) {
  const clamp = (x) => Math.max(0.3, Math.min(3.5, x));
  const lambda = clamp(base + ((eloHome + homeAdv) - eloAway) / denom);
  const mu = clamp(base + (eloAway - (eloHome + homeAdv)) / denom);
  let h = 0, d = 0, a = 0;
  for (let x = 0; x <= 10; x++) {
    const pA = poissonPmf(x, lambda);
    for (let y = 0; y <= 10; y++) {
      const p = pA * poissonPmf(y, mu) * dcTau(x, y, lambda, mu, rho);
      if (x > y) h += p; else if (x === y) d += p; else a += p;
    }
  }
  const s = h + d + a;
  return { h: h / s, d: d / s, a: a / s };
}

// ── elo history: rating as it stood before a given date ─────
const eloCache = new Map();
function eloSeries(slug) {
  if (eloCache.has(slug)) return eloCache.get(slug);
  const p = join(process.cwd(), "data", "elo-history", `${slug}.csv`);
  const series = existsSync(p)
    ? readFileSync(p, "utf8").trim().split("\n").slice(1).map((l) => {
        const c = l.split(",");
        return { date: c[5], elo: Number(c[4]) };
      }).filter((x) => x.date && x.elo > 0)
    : [];
  eloCache.set(slug, series);
  return series;
}
// Strictly before the match: a rating stamped on matchday already reflects the result.
function eloBefore(slug, date) {
  const s = eloSeries(slug);
  let found = null;
  for (const p of s) { if (p.date < date) found = p.elo; else break; }
  return found;
}

// ── team name → our slug ────────────────────────────────────
const meta = JSON.parse(readFileSync(join(process.cwd(), "data", "leagues-2026.json"), "utf8"));
const byApiId = new Map();
for (const rows of Object.values(meta)) {
  for (const c of rows) if (c.apiId) byApiId.set(c.apiId, c.slug);
}

// ── fetch (cached on disk: seasons never change) ────────────
async function seasonFixtures(leagueId, season) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${leagueId}-${season}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  if (!KEY) throw new Error("API_FOOTBALL_KEY needed for uncached seasons");
  const res = await fetch(`${BASE}/fixtures?league=${leagueId}&season=${season}`, {
    headers: { "x-apisports-key": KEY },
  });
  const body = await res.json();
  const errors = body?.errors;
  if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) {
    throw new Error(`API-Football: ${JSON.stringify(errors)}`);
  }
  const rows = (body.response || [])
    .filter((m) => m.fixture?.status?.short === "FT" && m.goals?.home != null)
    .map((m) => ({
      id: m.fixture.id,
      date: m.fixture.date.slice(0, 10),
      homeId: m.teams.home.id, awayId: m.teams.away.id,
      home: m.teams.home.name, away: m.teams.away.name,
      hg: m.goals.home, ag: m.goals.away,
    }));
  writeFileSync(file, JSON.stringify(rows));
  return rows;
}

// ── scoring ─────────────────────────────────────────────────
// `injuryK` converts one unavailable player into Elo points removed from that side. k=0
// disables the adjustment, which is how the null hypothesis gets tested alongside it.
function score(matches, params, injuryK = 0) {
  let n = 0, hits = 0, brier = 0, logloss = 0, favN = 0, favHits = 0;
  const BINS = 10;
  const bins = Array.from({ length: BINS }, () => ({ sumP: 0, sumY: 0, n: 0 }));
  for (const m of matches) {
    const p = matchProb(
      m.eloHome - injuryK * (m.absentHome ?? 0),
      m.eloAway - injuryK * (m.absentAway ?? 0),
      params,
    );
    const probs = [p.h, p.d, p.a];
    const actual = m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2;
    const pick = probs.indexOf(Math.max(...probs));
    n++;
    if (pick === actual) hits++;
    const top = Math.max(...probs);
    if (top >= 0.5) { favN++; if (pick === actual) favHits++; }
    for (let k = 0; k < 3; k++) {
      const y = k === actual ? 1 : 0;
      brier += (probs[k] - y) ** 2;
      const b = Math.min(BINS - 1, Math.floor(probs[k] * BINS));
      bins[b].sumP += probs[k]; bins[b].sumY += y; bins[b].n++;
    }
    logloss -= Math.log(Math.max(1e-12, probs[actual]));
  }
  const total = bins.reduce((s, b) => s + b.n, 0);
  const ece = total ? bins.reduce((s, b) =>
    s + (b.n / total) * Math.abs((b.n ? b.sumP / b.n : 0) - (b.n ? b.sumY / b.n : 0)), 0) : 0;
  return {
    n, hits, accuracy: hits / n, brier: brier / n, logloss: logloss / n,
    favN, favAccuracy: favN ? favHits / favN : 0, ece,
    bins: bins.map((b, i) => ({
      range: [i / BINS, (i + 1) / BINS], n: b.n,
      avgPred: b.n ? b.sumP / b.n : 0, obsFreq: b.n ? b.sumY / b.n : 0,
    })),
  };
}

// ── run ─────────────────────────────────────────────────────
const CURRENT = { base: 1.35, homeAdv: 65, rho: -0.13, denom: 400 };
const TEST_INJURIES = process.argv.includes("--injuries");

// Absences are counted, not weighted by the players' minutes. Season-total minutes would
// leak the future into a mid-season match — a player injured in September ends the season
// with few minutes, so weighting by them would quietly discount exactly the absences we
// are trying to detect. A plain count is cruder but honest; if it shows nothing, weighting
// it more cleverly is unlikely to rescue the idea.
const injuries = (() => {
  const f = join(CACHE, "injuries.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
})();

const matches = [];
let skippedNoElo = 0, skippedNoSlug = 0;
for (const season of SEASONS) {
  for (const lg of LEAGUES) {
    let rows;
    try { rows = await seasonFixtures(lg.id, season); }
    catch (e) { console.error(`  ! ${lg.slug} ${season}: ${e.message}`); continue; }
    for (const r of rows) {
      const hs = byApiId.get(r.homeId), as = byApiId.get(r.awayId);
      if (!hs || !as) { skippedNoSlug++; continue; }
      const eh = eloBefore(hs, r.date), ea = eloBefore(as, r.date);
      if (eh == null || ea == null) { skippedNoElo++; continue; }
      const absent = injuries?.[r.id];
      matches.push({
        ...r, league: lg.slug, season, eloHome: eh, eloAway: ea,
        absentHome: absent?.[r.homeId] ?? 0, absentAway: absent?.[r.awayId] ?? 0,
      });
    }
  }
}

console.log(`\nMatches usable: ${matches.length}  (skipped: ${skippedNoSlug} unknown club, ${skippedNoElo} no pre-match Elo)`);
if (!matches.length) { console.error("nothing to score"); process.exit(1); }
const bySeason = {};
for (const m of matches) bySeason[m.season] = (bySeason[m.season] || 0) + 1;
console.log(`By season: ${Object.entries(bySeason).map(([s, n]) => `${s}:${n}`).join("  ")}`);

const cur = score(matches, CURRENT);
const show = (label, s) => console.log(
  `${label.padEnd(26)} acc ${(s.accuracy * 100).toFixed(1)}%  fav ${(s.favAccuracy * 100).toFixed(1)}% (${s.favN})  ` +
  `Brier ${s.brier.toFixed(4)}  logloss ${s.logloss.toFixed(4)}  ECE ${(s.ece * 100).toFixed(2)}%`);

console.log(`\n── current constants (base ${CURRENT.base}, home ${CURRENT.homeAdv}, rho ${CURRENT.rho}, denom ${CURRENT.denom})`);
show("club backtest", cur);

// Baselines, so the number above has something to be judged against.
const alwaysHome = matches.filter((m) => m.hg > m.ag).length / matches.length;
const drawRate = matches.filter((m) => m.hg === m.ag).length / matches.length;
console.log(`\nBaselines: always-home ${(alwaysHome * 100).toFixed(1)}%   draws are ${(drawRate * 100).toFixed(1)}% of matches`);
console.log(`(A 1X2 top pick can rarely be "draw", so the draw rate is roughly the accuracy ceiling's opposite.)`);

console.log("\nCalibration (current constants):");
for (const b of cur.bins) {
  if (!b.n) continue;
  const bar = "█".repeat(Math.round(b.obsFreq * 40));
  console.log(`  ${(b.range[0] * 100).toFixed(0).padStart(3)}-${(b.range[1] * 100).toFixed(0).padStart(3)}%  n=${String(b.n).padStart(5)}  said ${(b.avgPred * 100).toFixed(1)}%  happened ${(b.obsFreq * 100).toFixed(1)}%  ${bar}`);
}

if (TEST_INJURIES) {
  console.log("\n── does knowing who is unavailable help? ────────────────");
  if (!injuries) {
    console.log("  no injuries.json — run scripts/fetch-injuries-history.mjs first");
  } else {
    const withData = matches.filter((m) => injuries[m.id]).length;
    const avgAbs = matches.reduce((s, m) => s + m.absentHome + m.absentAway, 0) / matches.length;
    console.log(`  ${withData}/${matches.length} matches have absence data; ${avgAbs.toFixed(1)} absences per match on average\n`);
    let best = { k: 0, s: score(matches, CURRENT, 0) };
    for (const k of [0, 2, 4, 6, 8, 10, 14, 18, 25, 35, 50]) {
      const s = score(matches, CURRENT, k);
      const mark = k === 0 ? "  (current: no adjustment)" : "";
      console.log(`  k=${String(k).padStart(2)} Elo/absence   acc ${(s.accuracy * 100).toFixed(2)}%  logloss ${s.logloss.toFixed(5)}  Brier ${s.brier.toFixed(5)}${mark}`);
      if (s.logloss < best.s.logloss) best = { k, s };
    }
    console.log(`\n  best k = ${best.k} → logloss ${best.s.logloss.toFixed(5)} vs ${score(matches, CURRENT, 0).logloss.toFixed(5)} unadjusted`);
    console.log(best.k === 0
      ? "  → no gain: a plain count of absentees carries no usable signal here."
      : `  → gain of ${((1 - best.s.logloss / score(matches, CURRENT, 0).logloss) * 100).toFixed(3)}% in log loss.`);
  }
}

if (SWEEP) {
  // Log loss is the target: it rewards being right *and* being honest about how sure you
  // are, which is the property the site actually claims. Accuracy alone would happily
  // accept a worse-calibrated model.
  console.log("\n── sweeping constants (objective: log loss) ─────────────");
  let best = { params: CURRENT, s: cur };
  const results = [];
  for (const base of [1.15, 1.25, 1.35, 1.45, 1.55]) {
    for (const homeAdv of [30, 45, 60, 65, 80, 95]) {
      for (const rho of [-0.18, -0.13, -0.08, -0.03, 0]) {
        for (const denom of [250, 300, 350, 400, 450]) {
          const params = { base, homeAdv, rho, denom };
          const s = score(matches, params);
          results.push({ params, s });
          if (s.logloss < best.s.logloss) best = { params, s };
        }
      }
    }
  }
  results.sort((a, b) => a.s.logloss - b.s.logloss);
  console.log(`Evaluated ${results.length} parameter sets. Top 5 by log loss:\n`);
  for (const r of results.slice(0, 5)) {
    show(`base${r.params.base} h${r.params.homeAdv} rho${r.params.rho} d${r.params.denom}`, r.s);
  }
  console.log(`\nCurrent constants rank: ${results.findIndex((r) =>
    r.params.base === CURRENT.base && r.params.homeAdv === CURRENT.homeAdv &&
    r.params.rho === CURRENT.rho && r.params.denom === CURRENT.denom) + 1} of ${results.length}`);
  console.log(`\nImprovement available: logloss ${cur.logloss.toFixed(4)} → ${best.s.logloss.toFixed(4)} ` +
    `(${((1 - best.s.logloss / cur.logloss) * 100).toFixed(2)}%), accuracy ${(cur.accuracy * 100).toFixed(1)}% → ${(best.s.accuracy * 100).toFixed(1)}%`);
}
