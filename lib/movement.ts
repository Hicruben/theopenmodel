// Week-on-week movement in a club's season outlook.
//
// A projection on its own is a fact you read once. The same projection next to what it
// was a week ago is a story you come back to — the number moves every time the club
// plays, and "did we get better or worse?" is the question fans actually argue about all
// season. It is also the honest way to show a forecast: a probability that never visibly
// changes looks like a guess nobody is maintaining.
import { loadSnapshot, snapshotDates, type SnapshotRow } from "./snapshots";

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

export function seasonMovement(leagueSlug: string, clubSlug: string, days = 7): SeasonMovement | null {
  const dates = snapshotDates();                 // newest first
  if (dates.length < 2) return null;

  const nowRow = findRow(dates[0], leagueSlug, clubSlug);
  if (!nowRow) return null;

  // The closest snapshot at least `days` old, so a missed build doesn't silently turn a
  // week's movement into a day's.
  const cutoff = new Date(new Date(`${dates[0]}T00:00:00Z`).getTime() - days * 86400_000)
    .toISOString().slice(0, 10);
  const thenDate = dates.find((d) => d <= cutoff) ?? dates[dates.length - 1];
  if (thenDate === dates[0]) return null;
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
    daysApart: Math.round(
      (new Date(`${dates[0]}T00:00:00Z`).getTime() - new Date(`${thenDate}T00:00:00Z`).getTime()) / 86400_000,
    ),
    title, top4, releg,
    xPts: move(nowRow.xPts, thenRow.xPts),
    elo: move(nowRow.elo, thenRow.elo),
    headline: candidates.length
      ? { key: candidates[0].key, label: LABEL[candidates[0].key], move: candidates[0].move }
      : null,
  };
}
