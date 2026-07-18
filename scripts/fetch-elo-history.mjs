#!/usr/bin/env node
// Fetch per-club Elo history from api.clubelo.com/<ClubNameNoSpaces> for every club in the
// 2026-27 rosters (data/leagues-2026.json). Skips clubs whose history file already exists;
// pass --force to refetch everything.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const rosters = JSON.parse(readFileSync(new URL("../data/leagues-2026.json", import.meta.url), "utf8"));
const clubs = Object.values(rosters).flat();
const force = process.argv.includes("--force");
mkdirSync(new URL("../data/elo-history/", import.meta.url), { recursive: true });

let ok = 0, skip = 0, fail = 0;
for (const c of clubs) {
  const dest = new URL(`../data/elo-history/${c.slug}.csv`, import.meta.url);
  if (!force && existsSync(dest)) { skip++; continue; }
  const api = c.club.replace(/[^A-Za-z]/g, "");
  try {
    const res = await fetch(`http://api.clubelo.com/${api}`);
    const text = await res.text();
    if (!text.startsWith("Rank,Club")) { console.log(`✗ ${c.club} (${api}): bad payload`); fail++; continue; }
    const lines = text.trim().split("\n");
    const recent = [lines[0], ...lines.slice(1).filter(l => (l.split(",")[5] || "") >= "2020-01-01")];
    writeFileSync(dest, recent.join("\n"));
    console.log(`✓ ${c.club}: ${recent.length - 1} periods`);
    ok++;
  } catch (e) { console.log(`✗ ${c.club}:`, String(e).slice(0, 60)); fail++; }
  await new Promise(r => setTimeout(r, 400));
}
console.log(`done: ${ok} fetched, ${skip} skipped, ${fail} failed`);
