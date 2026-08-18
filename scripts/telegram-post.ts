// Telegram broadcasting for the club season.
//
// The retention loop is a pair of posts: the model commits to predictions before a
// matchday, then gets scored on them afterwards. Publishing a call and then grading
// it is the one thing the big score sites don't do, and the running accuracy figure
// is what gives someone a reason to come back.
//
//   preview    — the next matchday's slate, most-confident picks and the coin flip
//   results    — full-time posts with the model's verdict on each match
//   scorecard  — what the last matchday cost us, plus the season record
//   poll       — "Who wins?" for matches kicking off soon (needs a sub-daily schedule)
//
// Adapted from the World Cup channel's posting script, which learned these rules the
// expensive way during the tournament — they are not optional:
//   · one post per slate per UTC day, enforced by a lock file. A stray re-run once
//     quadruple-posted the daily slate.
//   · lock/state files live in data/ so CI commits them back. GitHub Actions runners
//     are ephemeral; state kept anywhere else means no deduplication at all. (On the
//     old server the equivalent bug was keeping locks in /tmp, and a reboot re-fired
//     eight stale full-time posts.)
//   · groups get match essentials only. Relaying everything into groups got the bot
//     kicked out of the two biggest ones in a single evening.
//   · escape &, < and > — club names like "Brighton & Hove Albion" 400 otherwise.
//   · channel polls must be anonymous; Telegram rejects them otherwise.
//
// Without TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL this prints the posts and sends nothing,
// which is also how you preview copy: `npx tsx scripts/telegram-post.ts preview`.
// DRY_RUN=1 forces that behaviour even when credentials are present.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { LEAGUES } from "../lib/data";
import { clubRecord, type ScoredMatch } from "../lib/record";

const SITE = "https://theopenmodel.com";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL = process.env.TELEGRAM_CHANNEL;
const DRY = !TOKEN || !CHANNEL || process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1";

const STATE_DIR = join(process.cwd(), "data", "state");
// The relay daemon fans channel posts out to subscriber groups by reading appended
// message ids. "|nofan" keeps a post channel-only.
const OUTBOX = join(STATE_DIR, "relay-outbox");

// Every link is tagged so Umami can attribute traffic — and its quality — back to
// Telegram. The World Cup channel posted for a month without ever measuring this.
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
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(iso));
const timeLabel = (iso: string) =>
  `${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
    .format(new Date(iso))} UTC`;

function topPick(m: LockedMatch) {
  return [
    { side: "home" as const, label: m.home, p: m.p.h },
    { side: "draw" as const, label: "Draw", p: m.p.d },
    { side: "away" as const, label: m.away, p: m.p.a },
  ].sort((a, b) => b.p - a.p)[0];
}
const spread = (m: LockedMatch) => {
  const s = [m.p.h, m.p.d, m.p.a].sort((x, y) => y - x);
  return s[0] - s[1];
};

// ── pre-send validation ─────────────────────────────────────
// Automated posting means a bad pipeline broadcasts to every subscriber with nobody in
// the loop, and a wrong post is a credibility event for a product whose whole claim is
// that its numbers can be checked. A placeholder schedule (every fixture sharing one
// kickoff instant) once reached the site and would have been announced here, so these
// checks refuse to post rather than publish something suspect.
function assertSaneSlate(slate: LockedMatch[], { mustBeUpcoming }: { mustBeUpcoming: boolean }) {
  const fail = (why: string) => { throw new Error(`refusing to post — ${why}`); };
  if (!slate.length) fail("empty slate");

  for (const m of slate) {
    const sum = m.p.h + m.p.d + m.p.a;
    if (!Number.isFinite(sum) || Math.abs(sum - 1) > 0.02) {
      fail(`probabilities for ${m.home} v ${m.away} sum to ${sum.toFixed(3)}, not 1`);
    }
    if (!m.home || !m.away) fail(`a fixture is missing a club name (id ${m.id})`);
    if (Number.isNaN(new Date(m.date).getTime())) fail(`unparseable kickoff for ${m.home} v ${m.away}`);
    if (mustBeUpcoming && new Date(m.date).getTime() <= Date.now()) {
      fail(`${m.home} v ${m.away} has already kicked off — a preview must precede kickoff`);
    }
  }
  // A real matchday staggers kickoffs. More than four fixtures sharing one instant is the
  // signature of provider placeholder times, not a schedule.
  if (slate.length > 4 && new Set(slate.map((m) => m.date)).size === 1) {
    fail(`all ${slate.length} fixtures share one kickoff instant (${slate[0].date}) — looks like placeholder data`);
  }
}

// ── state ───────────────────────────────────────────────────
function readState<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(join(STATE_DIR, file), "utf8")); } catch { return fallback; }
}
function writeState(file: string, value: unknown) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(join(STATE_DIR, file), JSON.stringify(value, null, 1));
}

// ── telegram ────────────────────────────────────────────────
type Button = { text: string; url: string };

async function api(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!j.ok) console.error(`✗ telegram ${method}:`, JSON.stringify(j).slice(0, 200));
  return j;
}

// POSTING POLICY — what goes where, how often, and how loudly.
//
// Telegram channels have no algorithm: every post reaches every subscriber, so nothing
// is gained by posting more and nothing is throttled for posting less. The only failure
// mode is a human muting the channel, which is invisible in view counts for weeks. So
// the budget that matters is notifications, not posts.
//
//   mode       | audience | frequency                        | notifies
//   -----------+----------+----------------------------------+---------
//   preview    | channel  | at most 1/UTC day, and only when | YES — the
//              |          | something kicks off within 48h   | day's only one
//   scorecard  | channel  | once per matchday with results   | no
//   results    | channel  | per finished match, max 8/run    | no
//   poll       | channel  | per match entering its window    | no
//
// Nothing is sent when nothing kicks off inside 48 hours, so international breaks go
// quiet on their own. Silence is a retention feature, not a gap to fill.
//
// GROUPS ARE OFF. The relay fans channel posts out to the ~21 subscriber groups, and
// during the World Cup that fan-out — a reboot burst plus nine rest-day posts in one
// evening — got the bot removed from the two biggest groups the same day. A club season
// is five leagues over nine months, an order of magnitude more volume than a tournament,
// so groups stay opt-out until there is a reason to change it and a rule for what they
// receive. `fan` therefore defaults to false: a post reaches groups only by asking.
const FAN_TO_GROUPS_DEFAULT = false;

// `fan` decides whether subscriber groups get a copy.
const utcToday = () => new Date().toISOString().slice(0, 10);

// One notification per UTC day, enforced here rather than trusted to each call site.
// Subscribers forgive a channel that posts often and buzzes rarely; they mute one that
// buzzes twice in an evening, and a mute is permanent in practice.
function notificationSpent(): boolean {
  return readState<{ day?: string }>("tg-notified.json", {}).day === utcToday();
}

async function send(
  text: string,
  { buttons, silent = true, fan = FAN_TO_GROUPS_DEFAULT }: { buttons?: Button[][]; silent?: boolean; fan?: boolean } = {},
) {
  // Downgrade to silent once the day's notification is spent, rather than skipping the
  // post: the content is still worth having in the channel, it just shouldn't buzz.
  if (!silent && notificationSpent()) {
    console.log("◦ notification budget already spent today — sending silently.");
    silent = true;
  }
  if (DRY) {
    const chars = text.length;
    console.log(`\n${"─".repeat(64)}\n${chars} chars${chars > 4096 ? "  ⚠ OVER TELEGRAM'S 4096 LIMIT" : ""}${fan ? "" : "  · channel-only"}\n${"─".repeat(64)}`);
    console.log(text.replace(/<\/?[bi]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
    if (buttons?.length) console.log(`\n[buttons] ${buttons.flat().map((b) => b.text).join("  |  ")}`);
    return { ok: true, result: { message_id: 0 } };
  }
  const j = await api("sendMessage", {
    chat_id: CHANNEL,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    disable_notification: silent,
    ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
  if (j.ok && j.result?.message_id) {
    mkdirSync(STATE_DIR, { recursive: true });
    if (!silent) writeState("tg-notified.json", { day: utcToday(), at: new Date().toISOString() });
    try { appendFileSync(OUTBOX, `${j.result.message_id}${fan ? "" : "|nofan"}\n`); } catch { /* outbox is best-effort */ }
  }
  return j;
}

// ── preview ─────────────────────────────────────────────────
// Leads with conviction, then names the game the model genuinely can't call. The
// honest half is what makes the confident half worth believing.
async function preview() {
  const snap = latestSnapshot();
  const now = Date.now();
  const upcoming = (snap.matches ?? [])
    .filter((m) => new Date(m.date).getTime() > now)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) { console.log("ℹ preview: no upcoming locked predictions."); return; }

  // A rolling 48-hour window rather than a calendar day. Matchdays are not days: a
  // league's opening round can be spread across two weeks, while a settled weekend puts
  // thirty fixtures across five leagues into one afternoon. The window covers both.
  const slate = upcoming.filter((m) => new Date(m.date).getTime() < now + 48 * 3600_000);
  if (!slate.length) {
    console.log("ℹ preview: nothing kicks off in the next 48 hours — staying quiet.");
    return;
  }

  // One preview per UTC day, so a re-run cannot post the window twice.
  const today = new Date(now).toISOString().slice(0, 10);
  const lock = readState<{ day?: string }>("tg-preview.json", {});
  if (!FORCE && lock.day === today) {
    console.log(`ℹ preview: already posted today (${today}) — skipping (FORCE=1 to override).`);
    return;
  }

  assertSaneSlate(slate, { mustBeUpcoming: true });

  const byConfidence = [...slate].sort((a, b) => topPick(b).p - topPick(a).p);
  const tightest = [...slate].sort((a, b) => spread(a) - spread(b))[0];
  // On a short slate every match fits, so list them all rather than pretending a
  // three-match card has a "top three". Either way the closest call is never repeated
  // from the list above it — a match billed as both the most confident and the hardest
  // to call reads as sloppy, and undermines the numbers next to it.
  const listAll = slate.length <= 4;
  const featured = listAll
    ? byConfidence.filter((m) => m.id !== tightest.id)
    : byConfidence.filter((m) => m.id !== tightest.id).slice(0, 3);

  const header = [...new Set(slate.map((m) => m.league))]
    .map((l) => `${LEAGUE_FLAG.get(l) ?? ""} ${LEAGUE_NAME.get(l) ?? l}`)
    .join(" · ");

  const lines = [
    `⚽ <b>${esc(header)}</b> — next 48 hours`,
    "",
    `${slate.length} prediction${slate.length === 1 ? "" : "s"} locked and published now. Every one gets scored after full time.`,
  ];

  if (slate.length === 1) {
    // A single fixture has no slate to compare against, so "closest call" and "narrowest
    // margin" are simply false — and calling a 72% favourite the hardest match to call
    // undermines every other number we print. Just show the match.
    const m = slate[0];
    const t = topPick(m);
    lines.push("");
    lines.push(`<b>${esc(m.home)} v ${esc(m.away)}</b> <i>${timeLabel(m.date)}</i>`);
    lines.push(`${esc(m.home)} ${pct(m.p.h)} · Draw ${pct(m.p.d)} · ${esc(m.away)} ${pct(m.p.a)}`);
    lines.push(
      t.p >= 0.6 ? `<i>The model's clearest call in a while — ${esc(t.label)} to win.</i>`
        : spread(m) < 0.01 ? "<i>Too close to separate — the model can't call this one.</i>"
        : `<i>The model leans ${esc(t.label)}, without much conviction.</i>`,
    );
  } else {
    if (featured.length) {
      lines.push("");
      lines.push(listAll ? "🔒 <b>The model's calls</b>" : "🔒 <b>Most confident</b>");
      for (const m of featured) {
        const t = topPick(m);
        lines.push(`• ${esc(m.home)} v ${esc(m.away)} — <b>${esc(t.label)} ${pct(t.p)}</b> <i>${timeLabel(m.date)}</i>`);
      }
    }
    lines.push("");
    lines.push(`🎲 <b>Closest call</b> — ${esc(tightest.home)} v ${esc(tightest.away)} <i>${timeLabel(tightest.date)}</i>`);
    lines.push(`${esc(tightest.home)} ${pct(tightest.p.h)} · Draw ${pct(tightest.p.d)} · ${esc(tightest.away)} ${pct(tightest.p.a)}`);
    // Under a point the rounded numbers print identically, so claiming a lean reads as
    // self-contradictory. Saying so plainly is the more valuable answer anyway.
    lines.push(
      spread(tightest) < 0.01
        ? "<i>Too close to separate — the model can't call this one.</i>"
        : `<i>Narrowest margin on the slate — the model leans ${esc(topPick(tightest).label)}.</i>`,
    );
  }

  lines.push("");
  lines.push("<i>Published before kickoff. Scored afterwards — misses included.</i>");

  const buttons: Button[][] = [
    [{
      text: slate.length === 1 ? "📊 See the full prediction →" : `📊 All ${slate.length} predictions →`,
      url: link("/matches/", "preview"),
    }],
    [{ text: "📈 Track record →", url: link("/record/", "preview") }],
  ];
  // The slate is the flagship post of the matchday, so it earns a notification.
  const r = await send(lines.join("\n"), { buttons, silent: false });
  if (r.ok && !DRY) {
    writeState("tg-preview.json", { day: today, postedAt: new Date().toISOString() });
    console.log(`✓ preview posted (${slate.length} matches, ${today}).`);
  }
}

// ── results ─────────────────────────────────────────────────
// One post per finished match, each carrying the verdict on the model's own call.
async function results() {
  const rec = clubRecord();
  if (!rec.n) { console.log("ℹ results: no scored matches yet."); return; }

  const posted = new Set(readState<number[]>("tg-results.json", []));
  const fresh = rec.matches.filter((m) => !posted.has(m.id));
  if (!fresh.length) { console.log("ℹ results: nothing new to post."); return; }

  let n = 0;
  // Cap the batch: a backlog should trickle out, not flood the channel in one burst.
  for (const m of fresh.slice(0, 8)) {
    const conf = Math.max(m.p.h, m.p.d, m.p.a);
    const pickName = m.pick === "home" ? m.home : m.pick === "away" ? m.away : "Draw";
    const actualName = m.actual === "home" ? m.home : m.actual === "away" ? m.away : "Draw";
    const pActual = m.actual === "home" ? m.p.h : m.actual === "away" ? m.p.a : m.p.d;
    const verdict = m.correct
      ? `Model called <b>${esc(pickName)} ${pct(conf)}</b> ✅`
      : `UPSET — the model gave <b>${esc(actualName)}</b> only ${pct(pActual)} 😱`;

    const text =
      `🏁 <b>FULL-TIME</b>\n<b>${esc(m.home)} ${m.hg}–${m.ag} ${esc(m.away)}</b>\n\n${verdict}`;
    const buttons: Button[][] = [
      [{ text: "📈 Prediction vs result →", url: link("/record/", "results") }],
    ];
    // First of a batch rings; the rest stay quiet.
    const r = await send(text, { buttons, silent: n > 0 });
    if (r.ok) { posted.add(m.id); n++; }
  }
  if (!DRY) writeState("tg-results.json", [...posted]);
  console.log(`✓ results: posted ${n}.`);
}

// ── scorecard ───────────────────────────────────────────────
// The payoff post, and the trust engine: every call from the last matchday graded,
// then the season number that shifts a little each week.
async function scorecard() {
  const rec = clubRecord();
  if (!rec.n) { console.log("ℹ scorecard: no scored matches yet."); return; }

  const lastDay = rec.matches[rec.matches.length - 1].date.slice(0, 10);
  const lock = readState<{ day?: string }>("tg-scorecard.json", {});
  if (!FORCE && lock.day === lastDay) {
    console.log(`ℹ scorecard: already posted for ${lastDay} — skipping (FORCE=1 to override).`);
    return;
  }

  const slate = rec.matches.filter((m) => m.date.slice(0, 10) === lastDay);
  const hits = slate.filter((m) => m.correct).length;
  const conf = (m: ScoredMatch) => Math.max(m.p.h, m.p.d, m.p.a);
  const pickName = (m: ScoredMatch) => (m.pick === "home" ? m.home : m.pick === "away" ? m.away : "Draw");
  const actualName = (m: ScoredMatch) => (m.actual === "home" ? m.home : m.actual === "away" ? m.away : "Draw");

  // Best call = a correct pick the model was least sure of — a real read, not a gimme.
  const best = slate.filter((m) => m.correct).sort((a, b) => conf(a) - conf(b))[0];
  const worst = slate.filter((m) => !m.correct).sort((a, b) => conf(b) - conf(a))[0];

  const lines = [
    `📊 <b>Matchday scorecard</b> — ${dayLabel(slate[0].date)}`,
    "",
    `<b>${hits}/${slate.length}</b> correct on calls published before kickoff.`,
    "",
  ];
  for (const m of slate) {
    lines.push(`${m.correct ? "✅" : "❌"} ${esc(m.home)} ${m.hg}–${m.ag} ${esc(m.away)} — called ${esc(pickName(m))} ${pct(conf(m))}`);
  }
  lines.push("");
  if (best) lines.push(`🎯 <b>Best call</b>: ${esc(pickName(best))} at just ${pct(conf(best))}.`);
  if (worst) lines.push(`🤕 <b>Worst miss</b>: backed ${esc(pickName(worst))} at ${pct(conf(worst))}, got ${esc(actualName(worst))}.`);
  lines.push("");
  lines.push(`<b>Season: ${rec.hits}/${rec.n} correct (${pct(rec.accuracy)}).</b>`);
  lines.push("");
  lines.push("<i>Every call scored — misses included.</i>");

  const buttons: Button[][] = [
    [{ text: "📈 Full record, every miss →", url: link("/record/", "scorecard") }],
  ];
  const r = await send(lines.join("\n"), { buttons, silent: true });
  if (r.ok && !DRY) {
    writeState("tg-scorecard.json", { day: lastDay, postedAt: new Date().toISOString() });
    console.log(`✓ scorecard posted (${hits}/${slate.length}).`);
  }
}

// ── poll ────────────────────────────────────────────────────
// Cheapest engagement hook there is: readers commit to a guess, then the result post
// tells them whether they beat the model. Needs a sub-daily schedule to catch the
// window, so it is not part of the daily CI run.
async function poll() {
  const snap = latestSnapshot();
  const now = Date.now();
  const state = readState<Record<string, { messageId: number | null; kickoff: number; closed: boolean }>>("tg-polls.json", {});

  let closed = 0;
  for (const slug of Object.keys(state)) {
    const s = state[slug];
    if (s.messageId && !s.closed && s.kickoff <= now) {
      const r = DRY ? { ok: true } : await api("stopPoll", { chat_id: CHANNEL, message_id: s.messageId });
      if (r.ok) { s.closed = true; closed++; }
    }
  }

  // Matches kicking off within the next ~2 hours, excluding any already polled.
  const soon = (snap.matches ?? []).filter((m) => {
    const k = new Date(m.date).getTime();
    return k > now + 5 * 60_000 && k <= now + 120 * 60_000 && !state[m.slug];
  });

  let opened = 0;
  for (const m of soon.slice(0, 6)) {
    const question = `⚽ Who wins? ${m.home} v ${m.away}`.slice(0, 300);
    const options = [m.home.slice(0, 100), "Draw 🤝", m.away.slice(0, 100)];
    if (DRY) {
      console.log(`\n[poll] ${question}  (kickoff ${timeLabel(m.date)})\n  options: ${options.join(" / ")}`);
      state[m.slug] = { messageId: 0, kickoff: new Date(m.date).getTime(), closed: false };
      opened++;
      continue;
    }
    const r = await api("sendPoll", {
      chat_id: CHANNEL, question, options,
      is_anonymous: true, type: "regular", allows_multiple_answers: false, disable_notification: true,
    });
    if (r.ok) {
      state[m.slug] = { messageId: r.result.message_id, kickoff: new Date(m.date).getTime(), closed: false };
      opened++;
      try { appendFileSync(OUTBOX, `${r.result.message_id}\n`); } catch { /* best-effort */ }
    }
  }
  if (!DRY) writeState("tg-polls.json", state);
  console.log(`✓ polls: opened ${opened}, closed ${closed}.`);
}

// ── cli ─────────────────────────────────────────────────────
const MODES = { preview, results, scorecard, poll } as const;
const mode = (process.argv[2] ?? "preview") as keyof typeof MODES;
if (!(mode in MODES)) {
  console.error(`unknown mode "${mode}" — use: ${Object.keys(MODES).join(" | ")}`);
  process.exit(1);
}
async function main() {
  if (DRY) {
    console.log(TOKEN && CHANNEL
      ? "◦ DRY_RUN=1 — printing only, nothing will be sent."
      : "◦ no TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL — printing only, nothing will be sent.");
  }
  await MODES[mode]();
  if (DRY) console.log("\n◦ dry run complete — nothing was sent to Telegram.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
