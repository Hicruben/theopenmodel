// Weekly newsletter builder.
//
// The email is the only channel made mostly of returning readers, so it gets the
// discipline: the same three slots, the same day, every week. A reader should know
// exactly what is coming before they open it.
//
//   1. The biggest swing  — whose season odds moved most, and against what
//   2. One chart          — where a race actually stands right now
//   3. The worst miss     — the confident prediction that failed, named
//
// The third slot is the one that makes this worth reading. A model that only reports
// its wins is indistinguishable from one that quietly deletes its losses, so the miss
// is a fixed section rather than something published when there is room for it.
//
// Prints the issue; sending happens in Kit. Text and HTML come out of one source so
// they can never drift apart.
//
//   npx tsx scripts/newsletter.ts            # this week, versus 7 days ago
//   npx tsx scripts/newsletter.ts --html     # HTML body for pasting into Kit
import { loadSnapshot, snapshotDates, type Snapshot } from "../lib/snapshots";
import { clubRecord, type ScoredMatch } from "../lib/record";
import { LEAGUES } from "../lib/data";

const SITE = "https://theopenmodel.com";
const link = (path: string, campaign: string) =>
  `${SITE}${path}?utm_source=newsletter&utm_medium=email&utm_campaign=${campaign}`;

const LEAGUE_NAME = new Map(LEAGUES.map((l) => [l.slug, l.name]));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const pp = (x: number) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)}pp`;

// ── slot 1: the biggest swing ───────────────────────────────
type Metric = "title" | "top4" | "releg";
const METRIC_LABEL: Record<Metric, string> = {
  title: "title chance",
  top4: "top-four chance",
  releg: "relegation risk",
};

interface Swing {
  club: string; slug: string; league: string;
  metric: Metric; from: number; to: number; delta: number;
}

function biggestSwings(now: Snapshot, then: Snapshot, n = 5): Swing[] {
  const swings: Swing[] = [];
  for (const [league, rows] of Object.entries(now.leagues)) {
    const before = new Map((then.leagues[league] ?? []).map((r) => [r.slug, r]));
    for (const row of rows) {
      const was = before.get(row.slug);
      if (!was) continue;
      for (const metric of ["title", "top4", "releg"] as Metric[]) {
        const from = was[metric], to = row[metric];
        // Ignore noise: a race nobody is in doesn't move meaningfully.
        if (Math.abs(to - from) < 0.02) continue;
        swings.push({ club: row.club, slug: row.slug, league, metric, from, to, delta: to - from });
      }
    }
  }
  return swings.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, n);
}

// ── slot 2: the chart ───────────────────────────────────────
// A title race as a plain-text bar, which survives every email client and needs no
// image hosting. Kit renders it fine in a monospace block.
function raceChart(snap: Snapshot, league: string, n = 6): string[] {
  const rows = [...(snap.leagues[league] ?? [])].sort((a, b) => b.title - a.title).slice(0, n);
  if (!rows.length) return [];
  const width = 28;
  const top = rows[0].title || 1;
  const nameWidth = Math.max(...rows.map((r) => r.club.length));
  return rows.map((r) => {
    const bars = Math.round((r.title / top) * width);
    return `${r.club.padEnd(nameWidth)}  ${"█".repeat(bars).padEnd(width)} ${pct(r.title).padStart(4)}`;
  });
}

// ── slot 3: the worst miss ──────────────────────────────────
function worstMiss(since: string): ScoredMatch | null {
  const rec = clubRecord();
  const recent = rec.matches.filter((m) => m.date.slice(0, 10) >= since && !m.correct);
  if (!recent.length) return null;
  const conf = (m: ScoredMatch) => Math.max(m.p.h, m.p.d, m.p.a);
  return recent.sort((a, b) => conf(b) - conf(a))[0];
}

// Read as sentences rather than labels: "backed Rayo Vallecano" / "Sevilla won", never
// the raw outcome key, which produces things like "It finished Sevilla".
const pickPhrase = (m: ScoredMatch) =>
  m.pick === "home" ? m.home : m.pick === "away" ? m.away : "the draw";
const outcomePhrase = (m: ScoredMatch) =>
  m.actual === "draw" ? "it finished level" : `${m.actual === "home" ? m.home : m.away} won`;

// ── assemble ────────────────────────────────────────────────
function build() {
  const dates = snapshotDates();               // newest first
  if (!dates.length) throw new Error("no snapshots");
  const now = loadSnapshot(dates[0]);
  if (!now) throw new Error(`cannot load snapshot ${dates[0]}`);

  // Compare against the closest snapshot at least 7 days older, so the issue reports a
  // week of movement even when a build was missed.
  const weekAgo = new Date(new Date(`${dates[0]}T00:00:00Z`).getTime() - 7 * 86400_000)
    .toISOString().slice(0, 10);
  const thenDate = dates.find((d) => d <= weekAgo) ?? dates[dates.length - 1];
  const then = loadSnapshot(thenDate);

  const swings = then ? biggestSwings(now, then) : [];
  const rec = clubRecord();
  const miss = worstMiss(weekAgo);

  // Chart the league whose title race moved most this week; fall back to the first one.
  const chartLeague = swings.find((s) => s.metric === "title")?.league ?? LEAGUES[0].slug;

  return { now, then, thenDate, weekAgo, swings, rec, miss, chartLeague };
}

function textIssue(): string {
  const { now, thenDate, swings, rec, miss, chartLeague } = build();
  const L: string[] = [];

  L.push(`THE OPEN MODEL — week of ${now.date}`);
  L.push("");
  L.push(`Three things: what moved, one picture, and what we got wrong.`);
  L.push("");
  L.push("─".repeat(52));
  L.push("1. THE BIGGEST SWING");
  L.push("─".repeat(52));
  if (!swings.length) {
    L.push(`Nothing moved more than a couple of points since ${thenDate} — an unusually quiet week,`);
    L.push(`or the season is young enough that the simulations haven't shifted yet.`);
  } else {
    const top = swings[0];
    L.push(`${top.club} — ${METRIC_LABEL[top.metric]} ${pct(top.from)} → ${pct(top.to)} (${pp(top.delta)})`);
    L.push("");
    L.push(`Also moving since ${thenDate}:`);
    for (const s of swings.slice(1)) {
      L.push(`  · ${s.club} (${LEAGUE_NAME.get(s.league) ?? s.league}) ${METRIC_LABEL[s.metric]} ${pct(s.from)} → ${pct(s.to)}`);
    }
  }
  L.push("");
  L.push(`Full tables: ${link("/leagues/", "weekly")}`);
  L.push("");
  L.push("─".repeat(52));
  L.push(`2. ONE CHART — ${LEAGUE_NAME.get(chartLeague) ?? chartLeague} title race`);
  L.push("─".repeat(52));
  const chart = raceChart(now, chartLeague);
  L.push(...(chart.length ? chart : ["(no simulation data yet)"]));
  L.push("");
  L.push(`Chance of winning the league, from 5,000 simulated seasons.`);
  L.push("");
  L.push("─".repeat(52));
  L.push("3. WHAT THE MODEL GOT WRONG");
  L.push("─".repeat(52));
  if (!miss) {
    L.push(`No scored misses this week${rec.n ? "" : " — the season's record starts once matches are played"}.`);
  } else {
    const conf = Math.max(miss.p.h, miss.p.d, miss.p.a);
    L.push(`${miss.home} ${miss.hg}–${miss.ag} ${miss.away}`);
    L.push("");
    L.push(`The model backed ${pickPhrase(miss)} at ${pct(conf)}; ${outcomePhrase(miss)}.`);
    L.push(`That call was published before kickoff and it stays on the record.`);
  }
  if (rec.n) {
    L.push("");
    L.push(`Season so far: ${rec.hits}/${rec.n} correct (${pct(rec.accuracy)}).`);
  }
  L.push("");
  L.push(`Every prediction, right and wrong: ${link("/record/", "weekly")}`);
  L.push(`Download the raw rows: ${link("/data/", "weekly")}`);
  L.push("");
  L.push("─".repeat(52));
  L.push(`Statistical forecasts only — not betting advice, and no edge over bookmakers is claimed.`);
  L.push(`Open source: https://github.com/Hicruben/theopenmodel`);
  return L.join("\n");
}

function htmlIssue(): string {
  // Kit accepts pasted HTML. Keep it plain: inline styles only, no external assets, and
  // the chart in a <pre> so alignment survives.
  const { now, thenDate, swings, rec, miss, chartLeague } = build();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const h: string[] = [];
  const rule = `<hr style="border:none;border-top:1px solid #ddd;margin:26px 0">`;

  h.push(`<p style="color:#666;font-size:14px">Three things: what moved, one picture, and what we got wrong.</p>`);
  h.push(rule);
  h.push(`<h2 style="font-size:17px;margin:0 0 10px">1. The biggest swing</h2>`);
  if (!swings.length) {
    h.push(`<p>Nothing moved more than a couple of points since ${thenDate}.</p>`);
  } else {
    const t = swings[0];
    h.push(`<p style="font-size:16px"><b>${esc(t.club)}</b> — ${METRIC_LABEL[t.metric]} ${pct(t.from)} → <b>${pct(t.to)}</b> (${pp(t.delta)})</p>`);
    if (swings.length > 1) {
      h.push(`<ul style="color:#444;font-size:14px">` + swings.slice(1).map((s) =>
        `<li>${esc(s.club)} (${esc(LEAGUE_NAME.get(s.league) ?? s.league)}) ${METRIC_LABEL[s.metric]} ${pct(s.from)} → ${pct(s.to)}</li>`).join("") + `</ul>`);
    }
  }
  h.push(`<p><a href="${link("/leagues/", "weekly")}">Full tables →</a></p>`);
  h.push(rule);
  h.push(`<h2 style="font-size:17px;margin:0 0 10px">2. One chart — ${esc(LEAGUE_NAME.get(chartLeague) ?? chartLeague)} title race</h2>`);
  h.push(`<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.5;background:#f6f6f4;padding:14px;overflow-x:auto">${esc(raceChart(now, chartLeague).join("\n")) || "(no simulation data yet)"}</pre>`);
  h.push(`<p style="color:#666;font-size:13px">Chance of winning the league, from 5,000 simulated seasons.</p>`);
  h.push(rule);
  h.push(`<h2 style="font-size:17px;margin:0 0 10px">3. What the model got wrong</h2>`);
  if (!miss) {
    h.push(`<p>No scored misses this week.</p>`);
  } else {
    const conf = Math.max(miss.p.h, miss.p.d, miss.p.a);
    h.push(`<p style="font-size:16px"><b>${esc(miss.home)} ${miss.hg}–${miss.ag} ${esc(miss.away)}</b></p>`);
    h.push(`<p>The model backed ${esc(pickPhrase(miss))} at <b>${pct(conf)}</b>; ${esc(outcomePhrase(miss))}. That call was published before kickoff and it stays on the record.</p>`);
  }
  if (rec.n) h.push(`<p><b>Season so far: ${rec.hits}/${rec.n} correct (${pct(rec.accuracy)}).</b></p>`);
  h.push(`<p><a href="${link("/record/", "weekly")}">Every prediction, right and wrong →</a><br><a href="${link("/data/", "weekly")}">Download the raw rows →</a></p>`);
  h.push(rule);
  h.push(`<p style="color:#888;font-size:12px">Statistical forecasts only — not betting advice, and no edge over bookmakers is claimed. Open source: <a href="https://github.com/Hicruben/theopenmodel">github.com/Hicruben/theopenmodel</a></p>`);
  return h.join("\n");
}

const wantHtml = process.argv.includes("--html");
console.log(wantHtml ? htmlIssue() : textIssue());
