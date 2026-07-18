#!/usr/bin/env node
// Refresh data/clubelo-latest.csv from api.clubelo.com (free, daily).
// ClubElo drops clubs whose rating period has lapsed (off-season gap between
// "To" and the next period) — so we merge in a fallback snapshot from a few
// weeks back to backfill anyone missing (e.g. Bayern vanished 2026-07-04).
import { writeFileSync } from "node:fs";

async function snapshot(date) {
  const res = await fetch(`http://api.clubelo.com/${date}`);
  if (!res.ok) throw new Error(`clubelo ${date} → ${res.status}`);
  const csv = await res.text();
  if (!csv.startsWith("Rank,Club")) throw new Error(`unexpected payload for ${date}`);
  return csv.trim().split("\n");
}

const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const fallbackDate = new Date(today.getTime() - 21 * 86400_000);

const [current, fallback] = await Promise.all([snapshot(iso(today)), snapshot(iso(fallbackDate))]);
const have = new Set(current.slice(1).map((l) => l.split(",")[1]));
const added = [];
for (const line of fallback.slice(1)) {
  const club = line.split(",")[1];
  if (!have.has(club)) { current.push(line); added.push(club); }
}

writeFileSync(new URL("../data/clubelo-latest.csv", import.meta.url), current.join("\n") + "\n");
console.log(`✓ clubelo snapshot ${iso(today)}: ${current.length - 1} clubs` +
  (added.length ? ` (backfilled ${added.length} from ${iso(fallbackDate)}: ${added.slice(0, 8).join(", ")}${added.length > 8 ? "…" : ""})` : ""));
