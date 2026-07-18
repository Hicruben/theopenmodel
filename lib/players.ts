// Player data from API-Football: last season's top scorers per league + current squads.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Scorer {
  name: string; photo: string; age: number;
  team: string; teamId: number; teamLogo: string;
  goals: number; assists: number; apps: number;
}

export interface SquadPlayer {
  name: string; age: number; number: number | null; position: string; photo: string;
}

let scorers: Record<string, Scorer[]> | null = null;
let squads: Record<string, SquadPlayer[]> | null = null;

export function topScorers(leagueSlug: string): Scorer[] {
  if (!scorers) scorers = JSON.parse(readFileSync(join(process.cwd(), "data", "topscorers-2025.json"), "utf8"));
  return scorers![leagueSlug] ?? [];
}

export function squadOf(apiId: number | undefined): SquadPlayer[] {
  if (!apiId) return [];
  if (!squads) squads = JSON.parse(readFileSync(join(process.cwd(), "data", "squads-2026.json"), "utf8"));
  return squads![String(apiId)] ?? [];
}

// A representative 6: lean attack-heavy — the faces people recognize.
export function keyPlayers(apiId: number | undefined): SquadPlayer[] {
  const sq = squadOf(apiId);
  const by = (pos: string) => sq.filter((p) => p.position === pos);
  return [...by("Attacker").slice(0, 3), ...by("Midfielder").slice(0, 2), ...by("Goalkeeper").slice(0, 1)];
}
