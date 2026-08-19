#!/usr/bin/env node
// Refresh data/clubelo-latest.csv from api.clubelo.com (free, daily).
// ClubElo drops clubs whose rating period has lapsed (off-season gap between
// "To" and the next period) — so we merge in a fallback snapshot from a few
// weeks back to backfill anyone missing (e.g. Bayern vanished 2026-07-04).
import { writeFileSync } from "node:fs";

// ClubElo is a free single-maintainer service and goes unresponsive for stretches — it
// answered fine this morning and timed out entirely this afternoon. Without retries a
// single bad minute leaves the ratings unrefreshed for a day, which is how they silently
// fell a month behind in the first place.
async function snapshot(date, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    if (i) await new Promise((r) => setTimeout(r, 3000 * i));
    try {
      const res = await fetch(`http://api.clubelo.com/${date}`, {
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`clubelo ${date} → ${res.status}`);
      const csv = await res.text();
      if (!csv.startsWith("Rank,Club")) throw new Error(`unexpected payload for ${date}`);
      return csv.trim().split("\n");
    } catch (e) {
      lastError = e;
      console.warn(`  clubelo ${date}: attempt ${i + 1}/${attempts} failed (${e.message})`);
    }
  }
  throw lastError;
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
