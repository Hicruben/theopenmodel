// Data layer.
// League membership: API-Football 2026-27 rosters (data/leagues-2026.json) — authoritative,
// ClubElo's level flags lag promotion/relegation. Strength: ClubElo Elo, joined at build.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ClubRow {
  club: string;       // ClubElo display name, e.g. "Man City"
  country: string;    // ENG/ESP/GER/ITA/FRA…
  elo: number;
  slug: string;
  apiId?: number;     // API-Football team id
  logo?: string;      // real crest (media.api-sports.io)
}

export interface League {
  slug: string;
  name: string;
  country: string;
  flag: string;       // emoji (fallback)
  flagCode: string;   // flagcdn.com code
}

export const LEAGUES: League[] = [
  { slug: "premier-league", name: "Premier League", country: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", flagCode: "gb-eng" },
  { slug: "la-liga",        name: "La Liga",        country: "ESP", flag: "🇪🇸", flagCode: "es" },
  { slug: "serie-a",        name: "Serie A",        country: "ITA", flag: "🇮🇹", flagCode: "it" },
  { slug: "bundesliga",     name: "Bundesliga",     country: "GER", flag: "🇩🇪", flagCode: "de" },
  { slug: "ligue-1",        name: "Ligue 1",        country: "FRA", flag: "🇫🇷", flagCode: "fr" },
];

export const flagUrl = (code: string, w: 20 | 40 | 80 = 40) => `https://flagcdn.com/w${w}/${code}.png`;

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
   .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

let rosters: Record<string, ClubRow[]> | null = null;

function loadRosters(): Record<string, ClubRow[]> {
  if (rosters) return rosters;
  rosters = JSON.parse(readFileSync(join(process.cwd(), "data", "leagues-2026.json"), "utf8"));
  return rosters!;
}

export function leagueClubs(league: League): ClubRow[] {
  return loadRosters()[league.slug] ?? [];
}

export function allClubs(): ClubRow[] {
  return Object.values(loadRosters()).flat();
}

export function clubBySlug(slug: string): ClubRow | undefined {
  return allClubs().find((c) => c.slug === slug);
}

export function leagueBySlug(slug: string): League | undefined {
  return LEAGUES.find((l) => l.slug === slug);
}

export function logoFor(slug: string): string | undefined {
  return clubBySlug(slug)?.logo;
}

// Top-N teams across the five leagues
export function topTeams(n = 20): ClubRow[] {
  return [...allClubs()].sort((a, b) => b.elo - a.elo).slice(0, n);
}
