// Week-on-week movement in a club's season outlook.
//
// A projection on its own is a fact you read once. The same projection next to what it
// was a week ago is a story you come back to — the number moves every time the club
// plays, and "did we get better or worse?" is the question fans actually argue about all
// season. It is also the honest way to show a forecast: a probability that never visibly
// changes looks like a guess nobody is maintaining.
import { loadSnapshot, snapshotDates, type SnapshotRow } from "./snapshots";
import { LEAGUES, leagueClubs } from "./data";
import { seasonOdds } from "./season";

export interface OddsMove {
  now: number;
  then: number;
  delta: number;
}

export interface SeasonMovement {
  comparedWith: string;        // snapshot date the comparison is against
  daysApart: number;
  title: OddsMove;
  top4: OddsMove;
  releg: OddsMove;
  xPts: OddsMove;
  elo: OddsMove;
  /** The outcome that moved most, ignoring races the club isn't in. */
  headline: { key: "title" | "top4" | "releg"; label: string; move: OddsMove } | null;
}

const LABEL = { title: "title chance", top4: "top-four chance", releg: "relegation risk" } as const;

function findRow(date: string, leagueSlug: string, clubSlug: string): SnapshotRow | null {
  const snap = loadSnapshot(date);
  return snap?.leagues?.[leagueSlug]?.find((r) => r.slug === clubSlug) ?? null;
}

// `current` is passed in rather than read from the newest snapshot. The projection shown
// on the page is computed live — including any correction for results the ratings provider
// hasn't processed — while the snapshot is a record of what was published that morning.
// Comparing snapshot against snapshot would report no movement on exactly the days the
// live numbers had just moved.
export function seasonMovement(
  leagueSlug: string,
  clubSlug: string,
  current: { title: number; top4: number; releg: number; xPts: number; elo: number },
  days = 7,
): SeasonMovement | null {
  const dates = snapshotDates();                 // newest first
  if (!dates.length) return null;

  const nowRow = current;

  // The closest snapshot at least `days` old, so a missed build doesn't silently turn a
  // week's movement into a day's.
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const thenDate = dates.find((d) => d <= cutoff) ?? dates[dates.length - 1];
  const thenRow = findRow(thenDate, leagueSlug, clubSlug);
  if (!thenRow) return null;

  const move = (a: number, b: number): OddsMove => ({ now: a, then: b, delta: a - b });
  const title = move(nowRow.title, thenRow.title);
  const top4 = move(nowRow.top4, thenRow.top4);
  const releg = move(nowRow.releg, thenRow.releg);

  // Only headline a race the club is actually in — a 0.2-point wobble in a title chance
  // of 0.1% is noise, and presenting it as this week's story would be silly.
  const candidates = ([
    { key: "title", move: title },
    { key: "top4", move: top4 },
    { key: "releg", move: releg },
  ] as const).filter((c) => Math.max(c.move.now, c.move.then) >= 0.03 && Math.abs(c.move.delta) >= 0.005);
  candidates.sort((a, b) => Math.abs(b.move.delta) - Math.abs(a.move.delta));

  return {
    comparedWith: thenDate,
    daysApart: Math.max(1, Math.round(
      (Date.now() - new Date(`${thenDate}T00:00:00Z`).getTime()) / 86400_000,
    )),
    title, top4, releg,
    xPts: move(nowRow.xPts, thenRow.xPts),
    elo: move(nowRow.elo, thenRow.elo),
    headline: candidates.length
      ? { key: candidates[0].key, label: LABEL[candidates[0].key], move: candidates[0].move }
      : null,
  };
}

// ── movers across every league ──────────────────────────────

export interface Mover {
  club: string;
  slug: string;
  league: string;
  leagueName: string;
  metric: "title" | "top4" | "releg";
  label: string;
  now: number;
  then: number;
  delta: number;
  /** True when the change is good news for the club. */
  good: boolean;
}

/**
 * The week's biggest shifts in season outlook, across all five leagues. This is the
 * closest thing a forecast has to news: a probability that moved is something that
 * happened, and it is the reason to look again next week rather than once.
 */
export function topMovers(n = 6, days = 7): Mover[] {
  const dates = snapshotDates();
  if (!dates.length) return [];
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const thenDate = dates.find((d) => d <= cutoff) ?? dates[dates.length - 1];
  const then = loadSnapshot(thenDate);
  if (!then) return [];

  const out: Mover[] = [];
  for (const league of LEAGUES) {
    const before = new Map((then.leagues?.[league.slug] ?? []).map((r) => [r.slug, r]));
    for (const o of seasonOdds(league.slug, leagueClubs(league))) {
      const was = before.get(o.slug);
      if (!was) continue;
      const metrics = [
        { metric: "title" as const, label: "title chance", now: o.title, then: was.title, good: true },
        { metric: "top4" as const, label: "top-four chance", now: o.top4, then: was.top4, good: true },
        { metric: "releg" as const, label: "relegation risk", now: o.releg, then: was.releg, good: false },
      ];
      for (const m of metrics) {
        const delta = m.now - m.then;
        // Ignore races the club is not in: a move within a probability that is near zero
        // either way is simulation noise dressed up as a story.
        if (Math.max(m.now, m.then) < 0.04 || Math.abs(delta) < 0.01) continue;
        out.push({
          club: o.club, slug: o.slug, league: league.slug, leagueName: league.name,
          metric: m.metric, label: m.label, now: m.now, then: m.then, delta,
          good: m.good ? delta > 0 : delta < 0,
        });
      }
    }
  }
  // One line per club, so a single result doesn't fill the list with its own side effects.
  const seen = new Set<string>();
  return out
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true)))
    .slice(0, n);
}
