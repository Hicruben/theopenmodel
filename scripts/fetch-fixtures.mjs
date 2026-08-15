#!/usr/bin/env node
// Refresh data/fixtures-2026.json — the season schedule every page, match slug and
// locked prediction is built from.
//
// This file previously had no fetcher at all: package.json pointed `data:fixtures` at a
// script that never existed, so the schedule written at launch was never refreshed. It
// carried placeholder kickoff times (all ten La Liga openers at the same instant) and the
// site published them for weeks. Hence the sanity checks below — a schedule that looks
// synthetic must fail loudly rather than quietly ship.
//
//   API_FOOTBALL_KEY=... node scripts/fetch-fixtures.mjs
//   DRY_RUN=1 ... node scripts/fetch-fixtures.mjs      # fetch + validate, write nothing
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

const KEY = process.env.API_FOOTBALL_KEY;
const SEASON = Number(process.env.FIXTURES_SEASON ?? 2026);
const DRY = process.env.DRY_RUN === "1";
const BASE = "https://v3.football.api-sports.io";
const DEST = join(process.cwd(), "data", "fixtures-2026.json");

// API-Football league ids for the five leagues in lib/data.ts.
const LEAGUES = [
  { slug: "premier-league", id: 39 },
  { slug: "la-liga", id: 140 },
  { slug: "serie-a", id: 135 },
  { slug: "bundesliga", id: 78 },
  { slug: "ligue-1", id: 61 },
];

if (!KEY) { console.error("✗ API_FOOTBALL_KEY is not set."); process.exit(1); }

async function api(path) {
  for (let attempt = 0; attempt <= 2; attempt++) {
    const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
    const body = await res.json();
    // API-Football answers 200 with an `errors` payload for auth, quota and IP problems,
    // so the HTTP status alone never tells you whether the call worked.
    const errors = body?.errors;
    const failed = errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length);
    if (failed) throw new Error(`API-Football: ${JSON.stringify(errors)}`);
    if (Array.isArray(body?.response)) return body.response;
    if (attempt === 2) throw new Error(`API-Football: unexpected response for ${path}`);
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  return [];
}

const out = {};
for (const league of LEAGUES) {
  const rows = await api(`/fixtures?league=${league.id}&season=${SEASON}`);
  out[league.slug] = rows
    .map((m) => ({
      id: m.fixture?.id,
      date: m.fixture?.date,
      round: m.league?.round,
      venue: m.fixture?.venue?.name ?? null,
      city: m.fixture?.venue?.city ?? null,
      homeId: m.teams?.home?.id,
      awayId: m.teams?.away?.id,
      home: m.teams?.home?.name,
      away: m.teams?.away?.name,
    }))
    .filter((f) => f.id && f.date && f.homeId && f.awayId)
    .sort((a, b) => a.date.localeCompare(b.date));
  console.log(`  ${league.slug.padEnd(16)} ${out[league.slug].length} fixtures`);
}

// ── sanity checks ───────────────────────────────────────────
// A real domestic calendar spreads kickoffs across several slots per matchday. When a
// provider hasn't finalised broadcast times it returns one placeholder time for the whole
// season, which is exactly the state that shipped wrong dates for weeks.
const problems = [];
for (const [slug, fixtures] of Object.entries(out)) {
  if (!fixtures.length) { problems.push(`${slug}: no fixtures returned`); continue; }
  if (fixtures.length < 180) problems.push(`${slug}: only ${fixtures.length} fixtures (expected 300+)`);

  const slots = new Set(fixtures.map((f) => f.date.slice(11, 16)));
  if (slots.size < 4) {
    problems.push(`${slug}: only ${slots.size} distinct kickoff time(s) across ${fixtures.length} fixtures — looks like placeholder times`);
  }
  // Matchday 1 spread across a single instant is the specific failure we shipped.
  const round1 = fixtures.filter((f) => /(-|\s)1$/.test(f.round ?? ""));
  if (round1.length > 4 && new Set(round1.map((f) => f.date)).size === 1) {
    problems.push(`${slug}: all ${round1.length} opening fixtures share one kickoff instant (${round1[0].date})`);
  }
}

if (problems.length) {
  console.error("\n✗ schedule failed validation — refusing to write:");
  for (const p of problems) console.error(`  · ${p}`);
  process.exit(1);
}

const total = Object.values(out).reduce((n, a) => n + a.length, 0);
if (DRY) {
  console.log(`\n◦ dry run — validated ${total} fixtures, wrote nothing.`);
  for (const [slug, f] of Object.entries(out)) {
    const opener = f[0];
    console.log(`  ${slug}: opens ${opener.date} ${opener.home} v ${opener.away}`);
  }
  process.exit(0);
}

// Compare against what we are replacing, so the diff is visible in the log rather than
// only in git.
try {
  const prev = JSON.parse(readFileSync(DEST, "utf8"));
  for (const slug of Object.keys(out)) {
    const before = prev[slug]?.[0]?.date;
    const after = out[slug][0]?.date;
    if (before && after && before !== after) console.log(`  ${slug}: opener moves ${before} → ${after}`);
  }
} catch { /* first write */ }

const tmp = `${DEST}.tmp`;
writeFileSync(tmp, JSON.stringify(out, null, 1));
renameSync(tmp, DEST);
console.log(`\n✓ wrote ${total} fixtures to data/fixtures-2026.json`);
