#!/usr/bin/env node
// Build data/leagues-2026.json: authoritative 2026-27 league rosters from API-Football
// (data/apifb-teams.jsonl) joined with ClubElo ratings (any level — promoted clubs sit at
// level 2 in ClubElo until their flags update). ClubElo's level-1 flags lag promotion/
// relegation, so API-Football owns membership; ClubElo owns strength.
import { readFileSync, writeFileSync } from "node:fs";

const LG = { 39: "premier-league", 140: "la-liga", 135: "serie-a", 78: "bundesliga", 61: "ligue-1" };
const LG_COUNTRY = { 39: "ENG", 140: "ESP", 135: "ITA", 78: "GER", 61: "FRA" };
const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// API-Football display name → ClubElo club name, where canon() can't bridge.
const ALIAS = {
  "Athletic Club": "Bilbao",
  "Paris Saint Germain": "Paris SG",
  "Stade Brestois 29": "Brest",
  "Estac Troyes": "Troyes",
  "Deportivo La Coruna": "La Coruna",
  "Racing Santander": "Racing",
  "AC Milan": "Milan",
  "AS Roma": "Roma",
  "Inter": "Inter",
  "Manchester United": "Man United",
  "Manchester City": "Man City",
  "Newcastle": "Newcastle",
  "Nottingham Forest": "Forest",
  "Wolves": "Wolves",
  "Atletico Madrid": "Atletico",
  "Real Betis": "Betis",
  "Real Sociedad": "Sociedad",
  "Celta Vigo": "Celta",
  "Deportivo Alaves": "Alaves",
  "Alaves": "Alaves",
  "Bayern München": "Bayern",
  "1899 Hoffenheim": "Hoffenheim",
  "Borussia Mönchengladbach": "Gladbach",
  "1. FC Köln": "Koeln",
  "Hamburger SV": "Hamburg",
  "FSV Mainz 05": "Mainz",
  "VfB Stuttgart": "Stuttgart",
  "SC Freiburg": "Freiburg",
  "FC Augsburg": "Augsburg",
  "Borussia Dortmund": "Dortmund",
  "Bayer Leverkusen": "Leverkusen",
  "Eintracht Frankfurt": "Frankfurt",
  "Werder Bremen": "Werder",
  "SC Paderborn 07": "Paderborn",
  "SV Elversberg": "Elversberg",
  "FC Schalke 04": "Schalke",
  "Union Berlin": "Union Berlin",
  "Hellas Verona": "Verona",
};

const canon = (s) => slugify(s)
  .replace(/\b(fc|cf|afc|ac|as|ss|ssc|sc|us|ogc|rc|rcd|cd|ud|sv|vfb|vfl|fsv|1899|07|04|05|1)\b/g, "")
  .replace(/manchester/g, "man").replace(/saint/g, "st")
  .replace(/munchen|munich/g, "").replace(/koln|cologne/g, "koeln")
  .replace(/-+/g, "-").replace(/^-+|-+$/g, "");

const csv = readFileSync(new URL("../data/clubelo-latest.csv", import.meta.url), "utf8");
const clubelo = csv.trim().split("\n").slice(1).map((l) => l.split(","))
  .map((r) => ({ club: r[1], country: r[2], level: Number(r[3]), elo: Math.round(Number(r[4]) * 10) / 10 }));

const api = readFileSync(new URL("../data/apifb-teams.jsonl", import.meta.url), "utf8")
  .trim().split("\n").map((l) => JSON.parse(l));

const out = {};
const misses = [];
for (const lg of api) {
  const country = LG_COUNTRY[lg.league];
  const pool = clubelo.filter((c) => c.country === country);
  const rows = [];
  for (const t of lg.teams) {
    const target = ALIAS[t.name];
    let ce = target ? pool.find((c) => c.club === target) : undefined;
    if (!ce) ce = pool.find((c) => canon(c.club) === canon(t.name));
    if (!ce) ce = pool.find((c) => canon(t.name).includes(canon(c.club)) || canon(c.club).includes(canon(t.name)));
    if (!ce) { misses.push(`${country} ${t.name}`); continue; }
    rows.push({
      slug: slugify(ce.club),
      club: ce.club,
      country,
      elo: ce.elo,
      apiId: t.id,
      logo: t.logo,
    });
  }
  rows.sort((a, b) => b.elo - a.elo);
  out[LG[lg.league]] = rows;
}

writeFileSync(new URL("../data/leagues-2026.json", import.meta.url), JSON.stringify(out, null, 1));
const total = Object.values(out).reduce((n, r) => n + r.length, 0);
console.log(`✓ leagues-2026.json: ${Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(", ")} (${total} clubs)`);
if (misses.length) console.log("✗ unmatched API teams:\n  " + misses.join("\n  "));
