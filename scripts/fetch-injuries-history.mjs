#!/usr/bin/env node
// Backfill historical absences so an availability adjustment can be tested rather than
// assumed. One request per league-season; the API returns every record for the season
// already keyed to a fixture.
//
//   API_FOOTBALL_KEY=... node scripts/fetch-injuries-history.mjs --seasons 2023,2024,2025
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const KEY = process.env.API_FOOTBALL_KEY;
if (!KEY) { console.error("✗ API_FOOTBALL_KEY is not set."); process.exit(1); }

const BASE = "https://v3.football.api-sports.io";
const CACHE = join(process.cwd(), "data", ".backtest-cache");
const OUT = join(CACHE, "injuries.json");
const seasonsArg = process.argv.indexOf("--seasons");
const SEASONS = seasonsArg > -1 ? process.argv[seasonsArg + 1].split(",").map(Number) : [2023, 2024, 2025];
const LEAGUES = [39, 140, 135, 78, 61];

mkdirSync(CACHE, { recursive: true });
// fixtureId -> { [teamId]: absentCount }
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

for (const season of SEASONS) {
  for (const league of LEAGUES) {
    const res = await fetch(`${BASE}/injuries?league=${league}&season=${season}`, {
      headers: { "x-apisports-key": KEY },
    });
    const body = await res.json();
    const errors = body?.errors;
    if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) {
      console.error(`  ! ${league}/${season}: ${JSON.stringify(errors)}`);
      continue;
    }
    let n = 0;
    for (const row of body.response || []) {
      const fid = row.fixture?.id, tid = row.team?.id;
      if (!fid || !tid) continue;
      // Only players actually unavailable. "Questionable" is a maybe, and counting maybes
      // as absences would blur the very signal we are trying to detect.
      if (row.player?.type && !/missing fixture/i.test(row.player.type)) continue;
      ((out[fid] ??= {})[tid] ??= 0);
      out[fid][tid]++;
      n++;
    }
    console.log(`  league ${league} season ${season}: ${n} absences`);
  }
}

writeFileSync(OUT, JSON.stringify(out));
console.log(`\n✓ ${Object.keys(out).length} fixtures with absence data → ${OUT}`);
