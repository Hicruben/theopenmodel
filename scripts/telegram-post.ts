// Telegram post generator for the club season.
//
// Turns the model's own data into the two posts that make up the retention loop:
//
//   preview   — before a matchday: what the model is committing to, with confidence
//   scorecard — after a matchday: what it got right and wrong, plus the running record
//
// The pairing is the point. A prediction published beforehand and scored afterwards
// is the one thing the big score sites don't do, and the running accuracy number is
// what gives someone a reason to come back.
//
// DRY RUN ONLY: this prints posts to stdout. It never contacts Telegram. Sending is a
// separate, deliberate step — posts get reviewed before anything reaches subscribers.
//
//   npx tsx scripts/telegram-post.ts preview
//   npx tsx scripts/telegram-post.ts scorecard
//   npx tsx scripts/telegram-post.ts both
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LEAGUES } from "../lib/data";
import { clubRecord, type ScoredMatch } from "../lib/record";

const SITE = "https://theopenmodel.com";

// Every link is tagged so Umami can attribute traffic (and its quality) back to
// Telegram. Posting without measurement is how the World Cup channel ran blind.
const link = (path: string, campaign: string) =>
  `${SITE}${path}?utm_source=telegram&utm_medium=social&utm_campaign=${campaign}`;

const LEAGUE_NAME = new Map(LEAGUES.map((l) => [l.slug, l.name]));
const LEAGUE_FLAG = new Map(LEAGUES.map((l) => [l.slug, l.flag]));

interface LockedMatch {
  id: number; slug: string; league: string; date: string;
  home: string; away: string; p: { h: number; d: number; a: number };
}
interface Snapshot { date: string; generatedAt: string; matches?: LockedMatch[] }

function latestSnapshot(): Snapshot {
  const dir = join(process.cwd(), "data", "snapshots");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) throw new Error("no snapshots found");
  return JSON.parse(readFileSync(join(dir, files[files.length - 1]), "utf8"));
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function topPick(m: LockedMatch) {
  const opts = [
    { side: "home" as const, label: m.home, p: m.p.h },
    { side: "draw" as const, label: "Draw", p: m.p.d },
    { side: "away" as const, label: m.away, p: m.p.a },
  ];
  return opts.sort((a, b) => b.p - a.p)[0];
}

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(iso));

// ── preview ─────────────────────────────────────────────────
// Leads with conviction (what the model is most sure of) and then the game it
// genuinely can't call — the honest bit is what makes the confident bit credible.
function preview(): string {
  const snap = latestSnapshot();
  const now = new Date();
  const upcoming = (snap.matches ?? [])
    .filter((m) => new Date(m.date) > now)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!upcoming.length) return "(no upcoming locked predictions in the latest snapshot)";

  // The next matchday = every match sharing the earliest upcoming date.
  const day = upcoming[0].date.slice(0, 10);
  const slate = upcoming.filter((m) => m.date.slice(0, 10) === day);

  const byConfidence = [...slate].sort((a, b) => topPick(b).p - topPick(a).p);
  const confident = byConfidence.slice(0, 3);
  // Closest match = smallest gap between the top two outcomes.
  const tightest = [...slate].sort((a, b) => {
    const gap = (m: LockedMatch) => {
      const s = [m.p.h, m.p.d, m.p.a].sort((x, y) => y - x);
      return s[0] - s[1];
    };
    return gap(a) - gap(b);
  })[0];

  const leagues = [...new Set(slate.map((m) => m.league))];
  const header = leagues.map((l) => `${LEAGUE_FLAG.get(l) ?? ""} ${LEAGUE_NAME.get(l) ?? l}`).join(" · ");

  const lines: string[] = [];
  lines.push(`⚽ ${header} — ${dayLabel(slate[0].date)}`);
  lines.push("");
  lines.push(`The model has locked ${slate.length} prediction${slate.length === 1 ? "" : "s"} for this matchday. Published now, scored after full time.`);
  lines.push("");
  lines.push("🔒 Most confident:");
  for (const m of confident) {
    const t = topPick(m);
    lines.push(`• ${m.home} v ${m.away} — ${t.label} ${pct(t.p)}`);
  }
  lines.push("");
  const tp = topPick(tightest);
  const tGap = (() => {
    const s = [tightest.p.h, tightest.p.d, tightest.p.a].sort((x, y) => y - x);
    return s[0] - s[1];
  })();
  lines.push(`🎲 Closest call: ${tightest.home} v ${tightest.away}`);
  lines.push(`   ${tightest.home} ${pct(tightest.p.h)} · Draw ${pct(tightest.p.d)} · ${tightest.away} ${pct(tightest.p.a)}`);
  // Below ~1pt the rounded percentages print identically, so claiming a "lean"
  // reads as self-contradictory. Say it's a coin flip instead — the honesty is
  // the product.
  lines.push(
    tGap < 0.01
      ? "   Too close to separate — the model genuinely can't call this one."
      : `   Narrowest margin on the slate — the model leans ${tp.label}.`,
  );
  lines.push("");
  lines.push(`All ${slate.length} predictions → ${link("/matches/", "preview")}`);
  lines.push("");
  lines.push("Every number was public before kickoff. We score them all afterwards — including the misses.");

  return lines.join("\n");
}

// ── scorecard ───────────────────────────────────────────────
// The payoff post: what the model called correctly, where it was wrong, and the
// season accuracy that moves a little every week.
function scorecard(): string {
  const rec = clubRecord();
  if (!rec.n) {
    return [
      "(no scored matches yet — the season hasn't produced results the model predicted)",
      "",
      "This post will populate automatically once matches finish and CI records the scores.",
    ].join("\n");
  }

  // Most recent matchday that has results.
  const lastDay = rec.matches[rec.matches.length - 1].date.slice(0, 10);
  const slate = rec.matches.filter((m) => m.date.slice(0, 10) === lastDay);
  const hits = slate.filter((m) => m.correct).length;

  const conf = (m: ScoredMatch) => Math.max(m.p.h, m.p.d, m.p.a);
  const pickLabel = (m: ScoredMatch) =>
    m.pick === "home" ? m.home : m.pick === "away" ? m.away : "Draw";
  const actualLabel = (m: ScoredMatch) =>
    m.actual === "home" ? m.home : m.actual === "away" ? m.away : "Draw";

  // Best call = correct pick the model was least sure of (a genuine read, not a gimme).
  const bestCall = slate.filter((m) => m.correct).sort((a, b) => conf(a) - conf(b))[0];
  // Worst miss = wrong pick the model was most sure of.
  const worstMiss = slate.filter((m) => !m.correct).sort((a, b) => conf(b) - conf(a))[0];

  const lines: string[] = [];
  lines.push(`📊 Matchday scorecard — ${dayLabel(slate[0].date)}`);
  lines.push("");
  lines.push(`The model went ${hits}/${slate.length} on results it predicted before kickoff.`);
  lines.push("");
  for (const m of slate) {
    lines.push(`${m.correct ? "✅" : "❌"} ${m.home} ${m.hg}–${m.ag} ${m.away} — called ${pickLabel(m)} ${pct(conf(m))}`);
  }
  lines.push("");
  if (bestCall) {
    lines.push(`🎯 Best call: ${pickLabel(bestCall)} at just ${pct(conf(bestCall))} — ${bestCall.home} ${bestCall.hg}–${bestCall.ag} ${bestCall.away}.`);
  }
  if (worstMiss) {
    lines.push(`🤕 Worst miss: backed ${pickLabel(worstMiss)} at ${pct(conf(worstMiss))}, got ${actualLabel(worstMiss)}.`);
  }
  lines.push("");
  lines.push(`Season so far: ${rec.hits}/${rec.n} correct (${pct(rec.accuracy)}).`);
  lines.push("");
  lines.push(`Full record, every prediction and every miss → ${link("/record/", "scorecard")}`);

  return lines.join("\n");
}

// ── cli ─────────────────────────────────────────────────────
const mode = process.argv[2] ?? "both";
const box = (title: string, body: string) => {
  const chars = body.length;
  console.log(`\n${"─".repeat(60)}\n${title}  (${chars} chars${chars > 4096 ? " ⚠ OVER TELEGRAM 4096 LIMIT" : ""})\n${"─".repeat(60)}`);
  console.log(body);
};

if (mode === "preview" || mode === "both") box("PREVIEW POST", preview());
if (mode === "scorecard" || mode === "both") box("SCORECARD POST", scorecard());
if (!["preview", "scorecard", "both"].includes(mode)) {
  console.error(`unknown mode "${mode}" — use: preview | scorecard | both`);
  process.exit(1);
}
console.log(`\n${"─".repeat(60)}\nDRY RUN — nothing was sent to Telegram.\n`);
