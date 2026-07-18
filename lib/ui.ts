// Shared formatting + the 538-style shaded probability cell.
import type { CSSProperties } from "react";

export const pct = (x: number, dp = 1) =>
  x >= 0.995 ? ">99%" : x < 0.001 ? "—" : `${(x * 100).toFixed(x < 0.1 ? 1 : dp)}%`;

// Background intensity ∝ probability; flip to dark text once the fill is bright (dark theme).
export function shade(p: number, tone: "green" | "red" | "gold" = "green"): CSSProperties {
  if (p < 0.001) return { color: "var(--faint)", textAlign: "center" };
  const a = Math.min(0.9, Math.pow(p, 0.62));
  const rgb = tone === "green" ? "76,192,109" : tone === "red" ? "224,90,58" : "230,195,92";
  return {
    background: `rgba(${rgb},${a.toFixed(3)})`,
    color: a > 0.45 ? "#0c1710" : "var(--ink)",
    textAlign: "center",
    fontWeight: a > 0.35 ? 600 : 400,
  };
}
