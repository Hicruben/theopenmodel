// Do the season projections mean anything?
//
// The site publishes a calibration figure of 0.68% — but that measures single matches, and
// a season projection is a different claim entirely. Nothing on the site has ever checked
// whether a club given a 30% relegation risk in August goes down about three times in ten.
// Until it does, a headline like "99.6% to be relegated" is an assertion, and asserting
// without checking is the thing this project exists to not do.
//
// Method: take each completed season, rate every club on where it stood before a ball was
// kicked, run the same Monte Carlo the site runs, and compare those probabilities with what
// actually happened. Relegation is scored as "finished in the bottom three" rather than by
// each league's real play-off rules, because bottom three is what the model claims.
//
//   npx tsx scripts/backtest-season.ts
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { simulateSeason } from "../lib/season";
import type { ClubRow } from "../lib/data";

const CACHE = join(process.cwd(), "data", ".backtest-cache");
const SEASONS = [2023, 2024, 2025];
const LEAGUES = [
  { slug: "premier-league", id: 39 },
  { slug: "la-liga", id: 140 },
  { slug: "serie-a", id: 135 },
  { slug: "bundesliga", id: 78 },
  { slug: "ligue-1", id: 61 },
];

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Same three-step match the roster build uses: explicit alias, then a canonical form that
// strips the club-type noise ("FC", "Real", "1899"), then a containment fallback. Written
// out here rather than imported because that build is a .mjs script, and a season backtest
// that silently mismatched clubs would be worse than no backtest.
const ALIAS: Record<string, string> = {
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

const canon = (s: string) => slugify(s)
  .replace(/\b(fc|cf|afc|ac|as|ss|ssc|sc|us|ogc|rc|rcd|cd|ud|sv|vfb|vfl|fsv|1899|07|04|05|1)\b/g, "")
  .replace(/manchester/g, "man").replace(/saint/g, "st")
  .replace(/munchen|munich/g, "").replace(/koln|cologne/g, "koeln")
  .replace(/-+/g, "-").replace(/^-+|-+$/g, "");

// ClubElo publishes a full snapshot for any date, which is what a pre-season rating needs:
// historical league-seasons contain clubs long since relegated out of the top five, and
// they have no file in data/elo-history.
const snapCache = new Map<string, { club: string; elo: number }[]>();
async function eloSnapshot(date: string) {
  if (snapCache.has(date)) return snapCache.get(date)!;
  const cached = join(CACHE, `clubelo-${date}.csv`);
  let csv: string;
  if (existsSync(cached)) csv = readFileSync(cached, "utf8");
  else {
    // ClubElo goes unresponsive for stretches; each snapshot is cached on disk so a run
    // that gets part-way through is not wasted.
    let last: unknown;
    csv = "";
    for (let i = 0; i < 4 && !csv; i++) {
      if (i) await new Promise((r) => setTimeout(r, 4000 * i));
      try {
        const res = await fetch(`http://api.clubelo.com/${date}`, { signal: AbortSignal.timeout(45_000) });
        if (!res.ok) throw new Error(`clubelo ${date} → ${res.status}`);
        const body = await res.text();
        if (!body.startsWith("Rank,Club")) throw new Error(`unexpected payload for ${date}`);
        csv = body;
      } catch (e) { last = e; console.warn(`  clubelo ${date}: attempt ${i + 1}/4 failed`); }
    }
    if (!csv) throw new Error(`could not fetch clubelo ${date}: ${(last as Error)?.message ?? "unknown"}`);
    writeFileSync(cached, csv);
  }
  const rows = csv.trim().split("\n").slice(1).map((l) => {
    const c = l.split(",");
    return { club: c[1], elo: Number(c[4]) };
  }).filter((r) => r.club && Number.isFinite(r.elo));
  snapCache.set(date, rows);
  return rows;
}

function matchElo(name: string, pool: { club: string; elo: number }[]): number | null {
  const target = ALIAS[name];
  let hit = target ? pool.find((c) => c.club === target) : undefined;
  if (!hit) hit = pool.find((c) => canon(c.club) === canon(name));
  if (!hit) hit = pool.find((c) => canon(name).includes(canon(c.club)) || canon(c.club).includes(canon(name)));
  return hit ? hit.elo : null;
}

interface Row { id: number; date: string; home: string; away: string; hg: number; ag: number }

// ── build each league-season, project it, then see what happened ──
interface Case { league: string; season: number; club: string; title: number; top4: number; releg: number; wonTitle: boolean; madeTop4: boolean; wentDown: boolean }

async function main() {
const cases: Case[] = [];
const skipped: string[] = [];

for (const season of SEASONS) {
  for (const lg of LEAGUES) {
    const f = join(CACHE, `${lg.id}-${season}.json`);
    if (!existsSync(f)) continue;
    const rows: Row[] = JSON.parse(readFileSync(f, "utf8"));
    if (rows.length < 250) { skipped.push(`${lg.slug} ${season}: only ${rows.length} matches`); continue; }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const kickoff = rows[0].date;
    const pool = await eloSnapshot(kickoff);

    // Final table from the results themselves — three points a win, goal difference to split.
    const table = new Map<string, { pts: number; gd: number; gf: number }>();
    const bump = (c: string) => table.get(c) ?? (table.set(c, { pts: 0, gd: 0, gf: 0 }), table.get(c)!);
    for (const r of rows) {
      const h = bump(r.home), a = bump(r.away);
      h.gf += r.hg; a.gf += r.ag;
      h.gd += r.hg - r.ag; a.gd += r.ag - r.hg;
      if (r.hg > r.ag) h.pts += 3; else if (r.hg < r.ag) a.pts += 3; else { h.pts++; a.pts++; }
    }
    const finish = [...table.entries()]
      .sort((x, y) => y[1].pts - x[1].pts || y[1].gd - x[1].gd || y[1].gf - x[1].gf)
      .map(([club]) => club);

    // Rate every club on the day before the season started. A club with no pre-season
    // rating (newly promoted and absent from the history) is dropped rather than guessed —
    // inventing a rating would make the projection look better than it is.
    const clubs: ClubRow[] = [];
    let missing = 0;
    for (const club of finish) {
      const elo = matchElo(club, pool);
      if (elo == null) { missing++; continue; }
      clubs.push({ club, country: "", elo, slug: slugify(club) });
    }
    if (missing > 2 || clubs.length < 16) {
      skipped.push(`${lg.slug} ${season}: ${missing} clubs without a pre-season rating`);
      continue;
    }

    const odds = simulateSeason(clubs);
    const champion = finish[0];
    const top4 = new Set(finish.slice(0, 4));
    const bottom3 = new Set(finish.slice(-3));

    for (const o of odds) {
      cases.push({
        league: lg.slug, season, club: o.club,
        title: o.title, top4: o.top4, releg: o.releg,
        wonTitle: o.club === champion, madeTop4: top4.has(o.club), wentDown: bottom3.has(o.club),
      });
    }
  }
}

console.log(`\n${cases.length} club-seasons projected from pre-season ratings`);
for (const s of skipped) console.log(`  (skipped ${s})`);

// ── calibration per outcome ─────────────────────────────────
function calibrate(label: string, p: (c: Case) => number, happened: (c: Case) => boolean) {
  const edges = [0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 1.0001];
  console.log(`\n── ${label} ──`);
  console.log("  said            n     predicted   actual");
  let sumP = 0, sumY = 0, ece = 0;
  for (let i = 0; i < edges.length - 1; i++) {
    const inBin = cases.filter((c) => p(c) >= edges[i] && p(c) < edges[i + 1]);
    if (!inBin.length) continue;
    const avgP = inBin.reduce((s, c) => s + p(c), 0) / inBin.length;
    const obs = inBin.filter(happened).length / inBin.length;
    ece += (inBin.length / cases.length) * Math.abs(avgP - obs);
    console.log(
      `  ${`${(edges[i] * 100).toFixed(0)}–${(edges[i + 1] * 100).toFixed(0)}%`.padEnd(12)} ` +
      `${String(inBin.length).padStart(4)}   ${(avgP * 100).toFixed(1).padStart(7)}%  ${(obs * 100).toFixed(1).padStart(7)}%` +
      `   ${Math.abs(avgP - obs) > 0.15 ? "  ← off" : ""}`,
    );
  }
  sumP = cases.reduce((s, c) => s + p(c), 0);
  sumY = cases.filter(happened).length;
  const brier = cases.reduce((s, c) => s + (p(c) - (happened(c) ? 1 : 0)) ** 2, 0) / cases.length;
  console.log(`  expected ${sumP.toFixed(1)} across all clubs, actually happened ${sumY} times`);
  console.log(`  Brier ${brier.toFixed(4)} · calibration error ${(ece * 100).toFixed(1)}pp`);
}

calibrate("Winning the league", (c) => c.title, (c) => c.wonTitle);
calibrate("Finishing top four", (c) => c.top4, (c) => c.madeTop4);
calibrate("Finishing bottom three", (c) => c.releg, (c) => c.wentDown);

// ── the confident calls, which is where it matters ──────────
console.log("\n── clubs the model was most certain about ──");
const confident = cases.filter((c) => c.releg >= 0.7 || c.title >= 0.7 || c.top4 >= 0.9);
for (const c of confident.sort((a, b) => b.releg - a.releg).slice(0, 12)) {
  const claim = c.releg >= 0.7 ? `${(c.releg * 100).toFixed(0)}% down` : c.title >= 0.7 ? `${(c.title * 100).toFixed(0)}% title` : `${(c.top4 * 100).toFixed(0)}% top4`;
  const truth = c.releg >= 0.7 ? (c.wentDown ? "went down ✓" : "stayed up ✗")
    : c.title >= 0.7 ? (c.wonTitle ? "won it ✓" : "didn't ✗")
    : (c.madeTop4 ? "top four ✓" : "missed ✗");
  console.log(`  ${c.club.padEnd(16)} ${String(c.season)} ${claim.padEnd(12)} → ${truth}`);
}
const relegCertain = cases.filter((c) => c.releg >= 0.7);
if (relegCertain.length) {
  console.log(`\n  of ${relegCertain.length} clubs given ≥70% relegation risk before a ball was kicked, ${relegCertain.filter((c) => c.wentDown).length} went down`);
}

}

main().catch((e) => { console.error(e); process.exit(1); });
