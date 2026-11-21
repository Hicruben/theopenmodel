#!/usr/bin/env node
// Free match-results sync from football-data.co.uk (2026-27 season CSVs for Europe's top 5 leagues).
// No API key required. Merges finished match scores into data/results-2026.json keyed by our
// fixture id from data/fixtures-2026.json, so /record/, lib/elo-live.ts and post-match recaps
// stay up to date even when API_FOOTBALL_KEY is on the free plan.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SEASON_CODE = process.env.FOOTBALL_DATA_SEASON || "2627";
const LEAGUES = [
  { slug: "premier-league", code: "E0" },
  { slug: "la-liga", code: "SP1" },
  { slug: "serie-a", code: "I1" },
  { slug: "bundesliga", code: "D1" },
  { slug: "ligue-1", code: "F1" },
];

// Explicit alias map from football-data.co.uk team names -> canonical normalized tokens
const ALIASES = {
  "man united": "manchester united",
  "man city": "manchester city",
  "nott'm forest": "nottingham forest",
  "nottm forest": "nottingham forest",
  "wolves": "wolverhampton",
  "sheffield united": "sheffield utd",
  "west brom": "west bromwich",
  "ath madrid": "atletico madrid",
  "ath bilbao": "athletic club",
  "sociedad": "real sociedad",
  "betis": "real betis",
  "espanol": "espanyol",
  "vallecano": "rayo vallecano",
  "celta": "celta vigo",
  "alaves": "deportivo alaves",
  "inter": "inter milan",
  "milan": "ac milan",
  "verona": "hellas verona",
  "ein frankfurt": "eintracht frankfurt",
  "m'gladbach": "borussia monchengladbach",
  "mgladbach": "borussia monchengladbach",
  "fc koln": "fc koln",
  "koln": "fc koln",
  "dortmund": "borussia dortmund",
  "leverkusen": "bayer leverkusen",
  "rb leipzig": "rb leipzig",
  "st pauli": "fc st pauli",
  "mainz": "fsv mainz 05",
  "werder bremen": "werder bremen",
  "bayern munich": "bayern munich",
  "paris sg": "paris saint germain",
  "st etienne": "saint etienne",
  "clermont": "clermont foot",
};

function norm(name) {
  const s = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES[s] || s;
}

function teamMatches(csvName, fxName, clubName) {
  const a = norm(csvName);
  const targets = [norm(fxName), norm(clubName)].filter(Boolean);
  for (const b of targets) {
    if (a === b) return true;
    if (a.length >= 4 && (b.includes(a) || a.includes(b))) return true;
  }
  // Token overlap fallback (ignoring generic prefixes/suffixes like fc, cf, sc, real, ac, as, sv, ogc, rc, st)
  const stop = new Set(["fc", "cf", "sc", "ac", "as", "sv", "rc", "ogc", "aj", "us", "ss", "ud", "cd", "sd", "rcd", "ca", "de", "la", "le", "el", "real", "club", "sporting", "athletic", "atletico", "stade", "olympique", "borussia", "eintracht", "vfl", "vfb", "tsg", "fsv", "1", "04", "05", "98", "1899", "2000", "paris", "saint", "united", "city"]);
  const tokA = a.split(" ").filter((t) => t.length >= 3 && !stop.has(t));
  if (!tokA.length) return false;
  for (const b of targets) {
    const tokB = new Set(b.split(" ").filter((t) => t.length >= 3 && !stop.has(t)));
    if (tokA.some((t) => tokB.has(t))) return true;
  }
  return false;
}

function parseCsvDate(d) {
  // DD/MM/YYYY or DD/MM/YY -> YYYY-MM-DD
  const parts = String(d || "").trim().split("/");
  if (parts.length !== 3) return null;
  let [dd, mm, yy] = parts;
  if (yy.length === 2) yy = `20${yy}`;
  return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const root = process.cwd();
const fixturesPath = join(root, "data", "fixtures-2026.json");
const leaguesPath = join(root, "data", "leagues-2026.json");
const resultsPath = join(root, "data", "results-2026.json");

if (!existsSync(fixturesPath) || !existsSync(leaguesPath)) {
  console.log("ℹ fixtures-2026.json or leagues-2026.json missing — skipping free results sync");
  process.exit(0);
}

const fixturesByLeague = JSON.parse(readFileSync(fixturesPath, "utf8"));
const rostersByLeague = JSON.parse(readFileSync(leaguesPath, "utf8"));

let resultsFile = { updated: new Date().toISOString(), results: {} };
if (existsSync(resultsPath)) {
  try { resultsFile = JSON.parse(readFileSync(resultsPath, "utf8")); } catch { /* keep fresh */ }
}

let added = 0;
let matchedTotal = 0;
let unmatchedTotal = 0;

for (const league of LEAGUES) {
  const url = `https://www.football-data.co.uk/mmz4281/${SEASON_CODE}/${league.code}.csv`;
  let text = "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": "theopenmodel-build/1.0" } });
    if (!res.ok) {
      console.warn(`⚠ ${league.slug}: HTTP ${res.status} from ${url}`);
      continue;
    }
    text = await res.text();
  } catch (err) {
    console.warn(`⚠ ${league.slug}: fetch failed (${err.message})`);
    continue;
  }

  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.length < 2) continue;
  const header = parseCsvLine(lines[0]);
  const iDate = header.indexOf("Date");
  const iHome = header.indexOf("HomeTeam");
  const iAway = header.indexOf("AwayTeam");
  const iFTHG = header.indexOf("FTHG");
  const iFTAG = header.indexOf("FTAG");
  if (iDate < 0 || iHome < 0 || iAway < 0 || iFTHG < 0 || iFTAG < 0) continue;

  const fxList = fixturesByLeague[league.slug] || [];
  const clubByApi = new Map((rostersByLeague[league.slug] || []).map((c) => [c.apiId, c.club]));

  let lMatched = 0, lAdded = 0, lUnmatched = 0;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCsvLine(lines[i]);
    const hg = Number(cols[iFTHG]);
    const ag = Number(cols[iFTAG]);
    if (!Number.isFinite(hg) || !Number.isFinite(ag) || cols[iFTHG] === "" || cols[iFTAG] === "") continue;
    const csvDate = parseCsvDate(cols[iDate]);
    if (!csvDate) continue;
    const csvHome = cols[iHome];
    const csvAway = cols[iAway];

    // Find matching fixture in this league (prefer exact date / closest date within 14 days)
    const candidates = fxList.filter((f) =>
      teamMatches(csvHome, f.home, clubByApi.get(f.homeId)) &&
      teamMatches(csvAway, f.away, clubByApi.get(f.awayId))
    );
    if (!candidates.length) {
      lUnmatched++;
      continue;
    }
    const csvTs = new Date(`${csvDate}T12:00:00Z`).getTime();
    candidates.sort((a, b) =>
      Math.abs(new Date(a.date).getTime() - csvTs) - Math.abs(new Date(b.date).getTime() - csvTs)
    );
    const fx = candidates[0];
    lMatched++;
    const key = String(fx.id);
    if (!resultsFile.results[key]) {
      resultsFile.results[key] = {
        id: fx.id,
        date: fx.date,
        league: league.slug,
        home: clubByApi.get(fx.homeId) || fx.home,
        away: clubByApi.get(fx.awayId) || fx.away,
        hg,
        ag,
      };
      lAdded++;
      added++;
    }
  }
  matchedTotal += lMatched;
  unmatchedTotal += lUnmatched;
  console.log(`  ${league.slug.padEnd(16)} matched=${lMatched} added=${lAdded} unmatched=${lUnmatched}`);
}

if (added > 0) {
  resultsFile.updated = new Date().toISOString();
  writeFileSync(resultsPath, JSON.stringify(resultsFile, null, 1));
  console.log(`✓ results-2026.json updated (+${added} new results, total ${Object.keys(resultsFile.results).length}, unmatched ${unmatchedTotal})`);
} else {
  console.log(`✓ results-2026.json already up to date (matched ${matchedTotal}, total ${Object.keys(resultsFile.results).length}, unmatched ${unmatchedTotal})`);
}
