// Prebuild: (1) write today's forecast snapshot to data/snapshots/YYYY-MM-DD.json —
// committed to git on deploy, which is what makes the prediction history verifiable;
// (2) regenerate the free data exports under public/data/ (CSV + JSON).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LEAGUES, leagueClubs, topTeams } from "../lib/data";
import { seasonOdds } from "../lib/season";
import { allFixtures } from "../lib/fixtures";
import { matchProb } from "../lib/model";
import { portalFixtures } from "../lib/portal";

const today = new Date().toISOString().slice(0, 10);
const snapDir = join(process.cwd(), "data", "snapshots");
mkdirSync(snapDir, { recursive: true });

// ── (1) daily snapshot ──────────────────────────────────────
const snapPath = join(snapDir, `${today}.json`);
const leagues: Record<string, unknown> = {};
for (const l of LEAGUES) {
  leagues[l.slug] = seasonOdds(l.slug, leagueClubs(l)).map((o) => ({
    slug: o.slug, club: o.club, elo: o.elo,
    title: +o.title.toFixed(4), top4: +o.top4.toFixed(4),
    releg: +o.releg.toFixed(4), xPts: +o.avgPts.toFixed(1),
  }));
}
// Lock the next 8 days of match probabilities into the snapshot — these are the
// pre-kickoff numbers the public record (lib/record.ts) scores against results.
const lockWindowMs = 8 * 86400_000;
const nowIso = new Date().toISOString();
const lockedMatches = allFixtures()
  .filter((f) => {
    const dt = new Date(f.date).getTime() - Date.now();
    return dt > 0 && dt < lockWindowMs;
  })
  .map((f) => {
    const p = matchProb(f.home.elo, f.away.elo);
    return {
      id: f.id, slug: f.slug, league: f.league.slug, date: f.date,
      home: f.home.club, away: f.away.club,
      p: { h: +p.home.toFixed(4), d: +p.draw.toFixed(4), a: +p.away.toFixed(4) },
    };
  });

if (!existsSync(snapPath)) {
  writeFileSync(snapPath, JSON.stringify({
    date: today,
    generatedAt: nowIso,
    note: "Season forecast as published on this date. 5,000 Monte Carlo runs per league from ClubElo ratings. `matches` locks the match probabilities that were public before kickoff.",
    top10: topTeams(10).map((c) => ({ slug: c.slug, club: c.club, elo: c.elo })),
    leagues,
    matches: lockedMatches,
  }, null, 1));
  console.log(`✓ snapshot ${today} written (${lockedMatches.length} match predictions locked)`);
} else {
  console.log(`ℹ snapshot ${today} already exists`);
}

// ── (1b) accumulate final results of covered fixtures ───────
// portal.json only keeps a rolling window, so finished scores are merged into a
// permanent file keyed by fixture id. Only fixtures we published predictions for.
const resultsPath = join(process.cwd(), "data", "results-2026.json");
const covered = new Map(allFixtures().map((f) => [f.id, f]));
let resultsFile: { updated: string; results: Record<string, unknown> } = { updated: nowIso, results: {} };
if (existsSync(resultsPath)) {
  try { resultsFile = JSON.parse(readFileSync(resultsPath, "utf8")); } catch { /* keep empty */ }
}
let added = 0;
for (const fx of portalFixtures()) {
  if (!fx.providerId || !fx.status.isFinished) continue;
  const ours = covered.get(fx.providerId);
  if (!ours || fx.score.home == null || fx.score.away == null) continue;
  if (resultsFile.results[String(fx.providerId)]) continue;
  resultsFile.results[String(fx.providerId)] = {
    id: fx.providerId, date: ours.date, league: ours.league.slug,
    home: ours.home.club, away: ours.away.club,
    hg: fx.score.home, ag: fx.score.away,
  };
  added++;
}
if (added > 0) {
  resultsFile.updated = nowIso;
  writeFileSync(resultsPath, JSON.stringify(resultsFile, null, 1));
}
console.log(`✓ results-2026.json: ${Object.keys(resultsFile.results).length} finished matches (${added} new)`);

// ── (2) public data exports ─────────────────────────────────
const outDir = join(process.cwd(), "public", "data");
mkdirSync(outDir, { recursive: true });

const forecastRows = LEAGUES.flatMap((l) =>
  (leagues[l.slug] as { slug: string; club: string; elo: number; title: number; top4: number; releg: number; xPts: number }[])
    .map((o) => ({ league: l.slug, ...o }))
);
writeFileSync(join(outDir, "season-forecast.json"), JSON.stringify({ updated: today, license: "CC BY 4.0 — link to theopenmodel.com", rows: forecastRows }, null, 1));
writeFileSync(join(outDir, "season-forecast.csv"),
  "league,slug,club,elo,xPts,pTitle,pTop4,pRelegation\n" +
  forecastRows.map((r) => `${r.league},${r.slug},"${r.club}",${r.elo},${r.xPts},${r.title},${r.top4},${r.releg}`).join("\n") + "\n");

const fixRows = allFixtures().map((f) => {
  const p = matchProb(f.home.elo, f.away.elo);
  return {
    date: f.date, league: f.league.slug, round: f.round,
    home: f.home.club, away: f.away.club,
    pHome: +p.home.toFixed(4), pDraw: +p.draw.toFixed(4), pAway: +p.away.toFixed(4),
    xgHome: +p.xgHome.toFixed(2), xgAway: +p.xgAway.toFixed(2),
    url: `https://theopenmodel.com/match/${f.slug}/`,
  };
});
writeFileSync(join(outDir, "fixtures-2026-27.json"), JSON.stringify({ updated: today, license: "CC BY 4.0 — link to theopenmodel.com", rows: fixRows }, null, 1));
writeFileSync(join(outDir, "fixtures-2026-27.csv"),
  "date,league,round,home,away,pHome,pDraw,pAway,xgHome,xgAway,url\n" +
  fixRows.map((r) => `${r.date},${r.league},"${r.round}","${r.home}","${r.away}",${r.pHome},${r.pDraw},${r.pAway},${r.xgHome},${r.xgAway},${r.url}`).join("\n") + "\n");

const eloRows = LEAGUES.flatMap((l) => leagueClubs(l).map((c) => ({ league: l.slug, slug: c.slug, club: c.club, elo: c.elo })));
writeFileSync(join(outDir, "elo-ratings.csv"),
  "league,slug,club,elo\n" + eloRows.map((r) => `${r.league},${r.slug},"${r.club}",${r.elo}`).join("\n") + "\n");

console.log(`✓ public/data exports: season-forecast (csv+json), fixtures-2026-27 (csv+json, ${fixRows.length} rows), elo-ratings.csv`);
