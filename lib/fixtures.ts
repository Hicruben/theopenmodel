// 2026-27 fixtures (API-Football) joined to our club records.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEAGUES, leagueClubs, type ClubRow, type League } from "./data";

interface RawFixture {
  id: number; date: string; round: string;
  venue: string | null; city: string | null;
  homeId: number; awayId: number; home: string; away: string;
}

export interface Fixture {
  id: number;
  slug: string;
  date: string;         // ISO kickoff
  round: string;
  venue: string | null;
  city: string | null;
  league: League;
  home: ClubRow;
  away: ClubRow;
}

let cache: Fixture[] | null = null;

export function allFixtures(): Fixture[] {
  if (cache) return cache;
  const raw: Record<string, RawFixture[]> = JSON.parse(
    readFileSync(join(process.cwd(), "data", "fixtures-2026.json"), "utf8"));
  const out: Fixture[] = [];
  for (const league of LEAGUES) {
    const byApi = new Map(leagueClubs(league).map((c) => [c.apiId, c]));
    for (const f of raw[league.slug] ?? []) {
      const home = byApi.get(f.homeId);
      const away = byApi.get(f.awayId);
      if (!home || !away) continue;
      out.push({
        id: f.id,
        slug: `${home.slug}-vs-${away.slug}-${f.date.slice(0, 10)}`,
        date: f.date,
        round: f.round,
        venue: f.venue,
        city: f.city,
        league, home, away,
      });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  cache = out;
  return out;
}

export function fixtureBySlug(slug: string): Fixture | undefined {
  return allFixtures().find((f) => f.slug === slug);
}

export function upcomingFixtures(n = 20, leagueSlug?: string): Fixture[] {
  const now = Date.now();
  const fx = allFixtures().filter((f) =>
    (!leagueSlug || f.league.slug === leagueSlug) && new Date(f.date).getTime() >= now
  );
  return fx.slice(0, n);
}

export function seasonOpener(): Fixture {
  return allFixtures()[0];
}

// Fixtures for a club, in date order.
export function clubFixtures(clubSlug: string, n = 10): Fixture[] {
  return allFixtures().filter((f) => f.home.slug === clubSlug || f.away.slug === clubSlug).slice(0, n);
}
