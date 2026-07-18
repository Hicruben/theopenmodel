import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SnapshotRow {
  slug: string; club: string; elo: number;
  title: number; top4: number; releg: number; xPts: number;
}
export interface Snapshot {
  date: string;
  generatedAt: string;
  top10: { slug: string; club: string; elo: number }[];
  leagues: Record<string, SnapshotRow[]>;
}

const dir = join(process.cwd(), "data", "snapshots");

export function snapshotDates(): string[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort().reverse();
  } catch { return []; }
}

export function loadSnapshot(date: string): Snapshot | null {
  try { return JSON.parse(readFileSync(join(dir, `${date}.json`), "utf8")); }
  catch { return null; }
}

export function previousSnapshot(date: string): Snapshot | null {
  const dates = snapshotDates();
  const i = dates.indexOf(date);
  return i >= 0 && i + 1 < dates.length ? loadSnapshot(dates[i + 1]) : null;
}
