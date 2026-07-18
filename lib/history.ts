// Per-club Elo history (data/elo-history/<slug>.csv, fetched by scripts/fetch-elo-history.mjs)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface EloPoint { date: string; elo: number; }

export function eloHistory(slug: string): EloPoint[] {
  const p = join(process.cwd(), "data", "elo-history", `${slug}.csv`);
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").trim().split("\n").slice(1);
  return lines.map((l) => {
    const parts = l.split(",");
    return { date: parts[5], elo: Math.round(Number(parts[4])) };
  }).filter((x) => x.date && x.elo > 0);
}

// Build an SVG path for a simple line chart (viewBox 0 0 w h)
// Elo change over a lookback window (days) — nearest rating period to the cutoff.
export function eloDelta(slug: string, days: number): number | null {
  const pts = eloHistory(slug);
  if (pts.length < 2) return null;
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  let past = pts[0];
  for (const p of pts) { if (p.date <= cutoff) past = p; else break; }
  return pts[pts.length - 1].elo - past.elo;
}

// Tiny inline sparkline for table rows (downsampled).
export function tinySpark(points: EloPoint[], w = 76, h = 20): string {
  if (points.length < 2) return "";
  const step = Math.max(1, Math.floor(points.length / 36));
  const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const elos = pts.map((p) => p.elo);
  const min = Math.min(...elos), max = Math.max(...elos);
  const span = Math.max(1, max - min);
  const sx = (w - 2) / (pts.length - 1);
  return pts.map((p, i) =>
    `${i === 0 ? "M" : "L"}${(1 + i * sx).toFixed(1)},${(2 + (h - 4) * (1 - (p.elo - min) / span)).toFixed(1)}`
  ).join(" ");
}

export function sparkPath(points: EloPoint[], w = 640, h = 160, pad = 6): {
  d: string; area: string; min: number; max: number; last: { x: number; y: number };
} {
  if (points.length < 2) return { d: "", area: "", min: 0, max: 0, last: { x: 0, y: 0 } };
  const elos = points.map((p) => p.elo);
  const min = Math.min(...elos), max = Math.max(...elos);
  const span = Math.max(1, max - min);
  const step = (w - pad * 2) / (points.length - 1);
  const xy = points.map((p, i) => ({
    x: pad + i * step,
    y: pad + (h - pad * 2) * (1 - (p.elo - min) / span),
  }));
  const d = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${d} L${xy[xy.length - 1].x.toFixed(1)},${h - pad} L${xy[0].x.toFixed(1)},${h - pad} Z`;
  return { d, area, min, max, last: xy[xy.length - 1] };
}
