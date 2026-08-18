#!/usr/bin/env node
// Fail the build when an input has quietly stopped updating.
//
// Three datasets went stale without anyone noticing, each the same way: a refresh script
// that was never wired into the build, or a fetch that failed and was swallowed so the
// last good file kept being served.
//
//   · the fixture list was written once at launch and never refreshed, so La Liga's
//     opening round carried placeholder kickoff times for weeks
//   · the provider snapshot sat 18 days out of date behind a quota error
//   · ClubElo ratings were frozen for a month, which meant every season projection was
//     computed from July's team strengths and nothing on the site could ever move
//
// None of those were visible on the pages themselves — a stale forecast looks exactly
// like a fresh one. This is the check that makes staleness loud.
//
//   node scripts/check-data-freshness.mjs
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const now = Date.now();
const DAY = 86400_000;
const problems = [];   // wrong or missing data — must not ship
const warnings = [];   // stale but not wrong, or upstream's fault — must not be silent
const notes = [];

const ageDays = (iso) => (now - new Date(iso).getTime()) / DAY;
const fmt = (d) => `${d.toFixed(1)}d`;

function check(label, fn) {
  try { fn(); } catch (e) { problems.push(`${label}: ${e.message}`); }
}

// ── ClubElo ratings: the input every projection is built from ──
check("clubelo", () => {
  const p = join(ROOT, "data", "clubelo-latest.csv");
  if (!existsSync(p)) throw new Error("data/clubelo-latest.csv is missing");
  const rows = readFileSync(p, "utf8").trim().split("\n").slice(1);
  const froms = rows.map((l) => l.split(",")[5]).filter(Boolean).sort();
  const newest = froms[froms.length - 1];
  const age = ageDays(newest);
  // ClubElo rolls a club's rating period forward at each fixture, so in season the newest
  // period is always within a few days. Ten days means the refresh has stopped.
  if (age > 10) throw new Error(`newest rating period is ${fmt(age)} old (${newest}) — refresh has stopped`);
  notes.push(`clubelo: ${rows.length} clubs, newest period ${newest} (${fmt(age)})`);

  // A fresh file is not the same as a live rating. ClubElo rolls each club's validity
  // window forward at every fixture whether or not it has processed the result, so the
  // dates above can look current while the numbers are months old — which is exactly what
  // happened at the start of the 2026-27 season. If matches have been played and no club's
  // rating has moved, the model is running on frozen strengths and nothing on the site can
  // change, however fresh the file looks.
  const resultsPath = join(ROOT, "data", "results-2026.json");
  if (!existsSync(resultsPath)) return;
  const results = Object.values(JSON.parse(readFileSync(resultsPath, "utf8")).results ?? {});
  const recent = results.filter((r) => ageDays(r.date) <= 14);
  if (recent.length < 5) return;                 // too early in the season to expect movement

  const dir = join(ROOT, "data", "elo-history");
  if (!existsSync(dir)) return;
  const played = new Set(recent.flatMap((r) => [r.home, r.away]));
  const current = new Map(rows.map((l) => { const c = l.split(","); return [c[1], Number(c[4])]; }));
  let checked = 0, stationary = 0;
  for (const [club, elo] of current) {
    if (!played.has(club)) continue;
    const f = join(dir, `${club.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`);
    if (!existsSync(f)) continue;
    const hist = readFileSync(f, "utf8").trim().split("\n").slice(1)
      .map((l) => { const c = l.split(","); return { date: c[5], elo: Number(c[4]) }; })
      .filter((x) => x.date);
    const cutoff = new Date(now - 21 * DAY).toISOString().slice(0, 10);
    let before = null;
    for (const p of hist) { if (p.date <= cutoff) before = p.elo; else break; }
    if (before == null) continue;
    checked++;
    if (Math.abs(elo - before) < 0.5) stationary++;
  }
  if (checked >= 4 && stationary === checked) {
    // A warning rather than a failure: the forecasts are stale, not wrong, and the cause
    // is upstream. Blocking the deploy would also stop results being recorded, which is
    // strictly worse than shipping a projection built on last month's strengths.
    warnings.push(
      `ratings are frozen — ${recent.length} matches played in the last 14 days, but none of ${checked} clubs involved ` +
      `has moved in 21 days. ClubElo has not processed this season yet, so no projection on the site can change.`,
    );
    return;
  }
  if (checked) notes.push(`clubelo: ${checked - stationary}/${checked} recently-played clubs have moved rating`);
});

// ── fixtures: kickoff times, match slugs, and what counts as pre-kickoff ──
check("fixtures", () => {
  const p = join(ROOT, "data", "fixtures-2026.json");
  if (!existsSync(p)) throw new Error("data/fixtures-2026.json is missing");
  const fx = JSON.parse(readFileSync(p, "utf8"));
  const all = Object.values(fx).flat();
  if (all.length < 1500) throw new Error(`only ${all.length} fixtures (expected ~1750)`);
  const upcoming = all.filter((f) => new Date(f.date).getTime() > now);
  if (!upcoming.length) throw new Error("no upcoming fixtures — the season list has run out");
  // The placeholder-schedule signature that shipped wrong dates: a whole round sharing one
  // kickoff instant.
  for (const [slug, rows] of Object.entries(fx)) {
    const slots = new Set(rows.map((f) => f.date.slice(11, 16)));
    if (slots.size < 4) throw new Error(`${slug} has ${slots.size} distinct kickoff time(s) — looks like placeholder data`);
  }
  notes.push(`fixtures: ${all.length} total, ${upcoming.length} upcoming`);
});

// ── provider snapshot: results, which is what the track record scores against ──
check("portal", () => {
  const p = join(ROOT, "data", "portal.json");
  if (!existsSync(p)) throw new Error("data/portal.json is missing");
  const portal = JSON.parse(readFileSync(p, "utf8"));
  const age = ageDays(portal.asOf);
  if (age > 3) throw new Error(`asOf is ${fmt(age)} old (${portal.asOf}) — results will stop being recorded`);
  const from = portal.coverage?.dateFrom;
  // The window must reach back past yesterday, or matches that finished in the evening
  // fall outside it before the next build runs and are never scored.
  if (from && ageDays(`${from}T00:00:00Z`) < 1) {
    throw new Error(`coverage starts ${from}, which is not far enough back to catch last night's results`);
  }
  notes.push(`portal: asOf ${portal.asOf.slice(0, 10)} (${fmt(age)}), covers ${from}→${portal.coverage?.dateTo}`);
});

// ── snapshots: the published record itself ──
check("snapshots", () => {
  const dir = join(ROOT, "data", "snapshots");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) throw new Error("no snapshots");
  const newest = files[files.length - 1].replace(".json", "");
  const age = ageDays(`${newest}T00:00:00Z`);
  if (age > 2) throw new Error(`newest snapshot is ${newest} (${fmt(age)}) — the daily build is not running`);
  notes.push(`snapshots: ${files.length} files, newest ${newest}`);
});

for (const n of notes) console.log(`  ✓ ${n}`);
for (const w of warnings) console.warn(`  ⚠ ${w}`);
if (problems.length) {
  console.error("\n✗ data freshness check failed:");
  for (const p of problems) console.error(`  · ${p}`);
  console.error("\nA stale forecast looks exactly like a fresh one on the page, which is why this fails the build instead of warning.");
  process.exit(1);
}
console.log(warnings.length ? `✓ no blocking problems (${warnings.length} warning)` : "✓ all datasets fresh");
