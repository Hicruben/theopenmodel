#!/usr/bin/env node
// Backfill per-match expected goals so an xG-based rating can be tested against the
// current Elo one.
//
// ClubElo rates teams on results, which means a side that wins 1-0 on one shot is
// promoted exactly like one that wins 4-0 while dominating. xG measures chances rather
// than conversion, so it should describe a team's strength with less noise — but that is
// a hypothesis, and this exists so it can be measured rather than assumed.
//
// One request per fixture, cached on disk. Finished seasons never change, so a rerun
// costs nothing.
//
//   API_FOOTBALL_KEY=... node scripts/fetch-xg-history.mjs --seasons 2023,2024,2025
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const KEY = process.env.API_FOOTBALL_KEY;
if (!KEY) { console.error("✗ API_FOOTBALL_KEY is not set."); process.exit(1); }

const BASE = "https://v3.football.api-sports.io";
const CACHE = join(process.cwd(), "data", ".backtest-cache");
const OUT = join(CACHE, "xg.json");
const seasonsArg = process.argv.indexOf("--seasons");
const SEASONS = seasonsArg > -1 ? process.argv[seasonsArg + 1].split(",").map(Number) : [2023, 2024, 2025];
const LEAGUES = [39, 140, 135, 78, 61];

mkdirSync(CACHE, { recursive: true });
const xg = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const before = Object.keys(xg).length;

async function api(path) {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
    const body = await res.json();
    const errors = body?.errors;
    const failed = errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length);
    if (failed) {
      // Quota exhaustion is reported in the body with HTTP 200, so it has to be read here.
      const text = JSON.stringify(errors);
      if (/limit/i.test(text)) { console.error(`\n✗ request limit reached — rerun tomorrow; ${Object.keys(xg).length - before} new rows are already saved.`); flush(); process.exit(1); }
      throw new Error(text);
    }
    if (Array.isArray(body?.response)) return body.response;
    if (attempt === 3) throw new Error(`unexpected response for ${path}`);
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  return [];
}

const flush = () => writeFileSync(OUT, JSON.stringify(xg));

// Collect the fixtures needing statistics, reusing the season files the backtest cached.
const wanted = [];
for (const season of SEASONS) {
  for (const league of LEAGUES) {
    const f = join(CACHE, `${league}-${season}.json`);
    let rows = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
    // The first version of the season cache didn't record fixture ids, and statistics
    // can only be requested by id — so those files have to be refetched once.
    if (rows && !rows.every((r) => r.id)) rows = null;
    if (!rows) {
      const resp = await api(`/fixtures?league=${league}&season=${season}`);
      rows = resp
        .filter((m) => m.fixture?.status?.short === "FT" && m.goals?.home != null)
        .map((m) => ({
          id: m.fixture.id, date: m.fixture.date.slice(0, 10),
          homeId: m.teams.home.id, awayId: m.teams.away.id,
          home: m.teams.home.name, away: m.teams.away.name,
          hg: m.goals.home, ag: m.goals.away,
        }));
      writeFileSync(f, JSON.stringify(rows));
    }
    // Older cache files predate storing the fixture id; those seasons need refetching.
    for (const r of rows) if (r.id && !xg[r.id]) wanted.push(r);
  }
}

console.log(`${wanted.length} fixtures need statistics (${before} already cached).`);
let done = 0, missing = 0;
for (const fx of wanted) {
  const stats = await api(`/fixtures/statistics?fixture=${fx.id}`);
  const pick = (teamId) => {
    const side = stats.find((s) => s.team?.id === teamId);
    const row = (side?.statistics || []).find((s) => s.type === "expected_goals");
    const v = row?.value;
    return v == null ? null : Number(v);
  };
  const h = pick(fx.homeId), a = pick(fx.awayId);
  if (h == null || a == null) { missing++; xg[fx.id] = null; }
  else xg[fx.id] = { h, a };
  done++;
  if (done % 200 === 0) { flush(); console.log(`  ${done}/${wanted.length} (${missing} without xG)`); }
}
flush();
const withXg = Object.values(xg).filter(Boolean).length;
console.log(`\n✓ ${withXg} fixtures have xG, ${Object.keys(xg).length - withXg} do not. Cached in ${OUT}`);
