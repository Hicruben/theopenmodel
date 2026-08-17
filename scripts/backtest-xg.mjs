#!/usr/bin/env node
// Does rating teams on chances created beat rating them on results?
//
// ClubElo moves on results, so a side that wins 1-0 from one shot gains exactly as much
// as one that wins 4-0 while creating twenty. Expected goals measure the chances rather
// than the finishing, and finishing is the noisiest part of football — so xG ought to
// describe a team's underlying strength sooner and more stably. Ought to. This measures it.
//
// Strictly walk-forward: matches are processed in date order, each one predicted from the
// ratings as they stood beforehand and only then used to update them. Both models are
// scored on exactly the same matches, so the comparison is like for like.
//
//   node scripts/backtest-xg.mjs            # Elo vs xG vs a blend of the two
//   node scripts/backtest-xg.mjs --sweep    # search the xG model's parameters
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

// ── shared model pieces ─────────────────────────────────────
const ELO = { base: 1.35, homeAdv: 65, rho: -0.13, denom: 400 };

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
// Turn a pair of scoring rates into 1X2 probabilities.
function probsFromLambdas(lambda, mu, rho) {
  let h = 0, d = 0, a = 0;
  for (let x = 0; x <= 10; x++) {
    const pA = poissonPmf(x, lambda);
    for (let y = 0; y <= 10; y++) {
      const p = pA * poissonPmf(y, mu) * dcTau(x, y, lambda, mu, rho);
      if (x > y) h += p; else if (x === y) d += p; else a += p;
    }
  }
  const s = h + d + a;
  return [h / s, d / s, a / s];
}
const clamp = (x) => Math.max(0.3, Math.min(3.5, x));

function eloProbs(eloHome, eloAway) {
  const lambda = clamp(ELO.base + ((eloHome + ELO.homeAdv) - eloAway) / ELO.denom);
  const mu = clamp(ELO.base + (eloAway - (eloHome + ELO.homeAdv)) / ELO.denom);
  return probsFromLambdas(lambda, mu, ELO.rho);
}

// ── elo history ─────────────────────────────────────────────
const eloCache = new Map();
function eloBefore(slug, date) {
  if (!eloCache.has(slug)) {
    const p = join(process.cwd(), "data", "elo-history", `${slug}.csv`);
    eloCache.set(slug, existsSync(p)
      ? readFileSync(p, "utf8").trim().split("\n").slice(1).map((l) => {
          const c = l.split(","); return { date: c[5], elo: Number(c[4]) };
        }).filter((x) => x.date && x.elo > 0)
      : []);
  }
  let found = null;
  for (const p of eloCache.get(slug)) { if (p.date < date) found = p.elo; else break; }
  return found;
}

// ── load ────────────────────────────────────────────────────
const meta = JSON.parse(readFileSync(join(process.cwd(), "data", "leagues-2026.json"), "utf8"));
const byApiId = new Map();
for (const rows of Object.values(meta)) for (const c of rows) if (c.apiId) byApiId.set(c.apiId, c.slug);

const xgFile = join(CACHE, "xg.json");
if (!existsSync(xgFile)) { console.error("✗ no xg.json — run scripts/fetch-xg-history.mjs first"); process.exit(1); }
const xgData = JSON.parse(readFileSync(xgFile, "utf8"));

const all = [];
for (const season of SEASONS) {
  for (const lg of LEAGUES) {
    const f = join(CACHE, `${lg.id}-${season}.json`);
    if (!existsSync(f)) continue;
    for (const r of JSON.parse(readFileSync(f, "utf8"))) {
      const xg = xgData[r.id];
      if (!xg) continue;                       // no chance data: can't rate it, can't score it
      all.push({ ...r, league: lg.slug, season, xgH: xg.h, xgA: xg.a });
    }
  }
}
all.sort((a, b) => a.date.localeCompare(b.date));
console.log(`\n${all.length} matches with xG, ${all[0]?.date} → ${all[all.length - 1]?.date}`);

// ── xG ratings, walk-forward ────────────────────────────────
// Each team carries an attack and a defence rating, both multipliers on the league's
// average scoring rate. They are updated after every match by an exponentially weighted
// step, which is the same idea as Elo but fed by chances instead of goals.
function runXg({ halfLife, homeFactor, rho, prior, burnIn }) {
  const alpha = 1 - Math.pow(0.5, 1 / halfLife);   // weight given to the newest match
  const att = new Map(), def = new Map(), seen = new Map();
  // League average xG per team per match, learned as we go rather than assumed.
  let leagueSum = 0, leagueN = 0;
  const rows = [];

  for (const m of all) {
    const hs = byApiId.get(m.homeId), as = byApiId.get(m.awayId);
    const mu = leagueN > 30 ? leagueSum / leagueN : 1.35;

    const aH = att.get(m.homeId) ?? prior, dH = def.get(m.homeId) ?? prior;
    const aA = att.get(m.awayId) ?? prior, dA = def.get(m.awayId) ?? prior;
    const nH = seen.get(m.homeId) ?? 0, nA = seen.get(m.awayId) ?? 0;

    // Only score once both sides have enough history for their ratings to mean anything.
    if (nH >= burnIn && nA >= burnIn) {
      const lambda = clamp(mu * aH * dA * homeFactor);
      const muL = clamp(mu * aA * dH / homeFactor);
      const eloH = hs ? eloBefore(hs, m.date) : null;
      const eloA = as ? eloBefore(as, m.date) : null;
      rows.push({
        m,
        xg: probsFromLambdas(lambda, muL, rho),
        elo: eloH != null && eloA != null ? eloProbs(eloH, eloA) : null,
      });
    }

    // Update on what actually happened, in chance terms.
    const obsH = m.xgH / Math.max(0.2, mu), obsA = m.xgA / Math.max(0.2, mu);
    att.set(m.homeId, aH + alpha * (obsH / Math.max(0.2, dA) - aH));
    def.set(m.homeId, dH + alpha * (obsA / Math.max(0.2, aA) - dH));
    att.set(m.awayId, aA + alpha * (obsA / Math.max(0.2, dH) - aA));
    def.set(m.awayId, dA + alpha * (obsH / Math.max(0.2, aH) - dA));
    seen.set(m.homeId, nH + 1); seen.set(m.awayId, nA + 1);
    leagueSum += m.xgH + m.xgA; leagueN += 2;
  }
  return rows;
}

// ── scoring ─────────────────────────────────────────────────
function scoreProbs(rows, pick) {
  let n = 0, hits = 0, brier = 0, logloss = 0;
  const BINS = 10;
  const bins = Array.from({ length: BINS }, () => ({ sumP: 0, sumY: 0, n: 0 }));
  for (const r of rows) {
    const probs = pick(r);
    if (!probs) continue;
    const actual = r.m.hg > r.m.ag ? 0 : r.m.hg === r.m.ag ? 1 : 2;
    n++;
    if (probs.indexOf(Math.max(...probs)) === actual) hits++;
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
  return { n, accuracy: hits / n, brier: brier / n, logloss: logloss / n, ece };
}

const show = (label, s) => console.log(
  `  ${label.padEnd(30)} n=${s.n}  acc ${(s.accuracy * 100).toFixed(2)}%  ` +
  `logloss ${s.logloss.toFixed(5)}  Brier ${s.brier.toFixed(5)}  ECE ${(s.ece * 100).toFixed(2)}%`);

const DEFAULT = { halfLife: 12, homeFactor: 1.18, rho: -0.13, prior: 1, burnIn: 10 };
const rows = runXg(DEFAULT).filter((r) => r.elo);   // like-for-like: both models must have a view

console.log(`\n── same ${rows.length} matches, both models ──────────────────`);
show("Elo (current, live)", scoreProbs(rows, (r) => r.elo));
show("xG ratings", scoreProbs(rows, (r) => r.xg));
for (const w of [0.25, 0.5, 0.75]) {
  show(`blend ${Math.round(w * 100)}% xG / ${Math.round((1 - w) * 100)}% Elo`,
    scoreProbs(rows, (r) => r.xg.map((p, i) => w * p + (1 - w) * r.elo[i])));
}

if (SWEEP) {
  console.log("\n── sweeping the xG model (objective: log loss) ──────────");
  const results = [];
  for (const halfLife of [6, 9, 12, 16, 22, 30]) {
    for (const homeFactor of [1.05, 1.10, 1.15, 1.18, 1.25]) {
      for (const rho of [-0.18, -0.13, -0.08, 0]) {
        const rs = runXg({ ...DEFAULT, halfLife, homeFactor, rho }).filter((r) => r.elo);
        results.push({ p: { halfLife, homeFactor, rho }, s: scoreProbs(rs, (r) => r.xg), rows: rs });
      }
    }
  }
  results.sort((a, b) => a.s.logloss - b.s.logloss);
  console.log("Top 5 xG configurations:");
  for (const r of results.slice(0, 5)) {
    show(`hl${r.p.halfLife} home${r.p.homeFactor} rho${r.p.rho}`, r.s);
  }
  const best = results[0];
  console.log("\nBest xG config blended with Elo:");
  for (const w of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    show(`blend ${Math.round(w * 100)}% xG`,
      scoreProbs(best.rows, (r) => r.xg.map((p, i) => w * p + (1 - w) * r.elo[i])));
  }
  show("Elo alone (reference)", scoreProbs(best.rows, (r) => r.elo));
}
