import type { MatchProb, MarketProbs } from "./model";

export interface EditorialTag {
  label: string;
  tone: "accent" | "win" | "loss" | "muted";
}

export function fairOdds(prob: number): string {
  if (!Number.isFinite(prob) || prob <= 0.005) return "—";
  return (1 / prob).toFixed(2);
}

/**
 * Deterministic editorial tags derived purely from model probabilities and xG,
 * giving readers instant scan-ability without manual copywriting.
 */
export function matchEditorialTags(p: MatchProb, mk: MarketProbs): EditorialTag[] {
  const tags: EditorialTag[] = [];
  const topProb = Math.max(p.home, p.away);
  const underdogProb = Math.min(p.home, p.away);
  const totalXg = p.xgHome + p.xgAway;

  if (topProb >= 0.66) {
    tags.push({ label: "Heavy favourite", tone: "win" });
  } else if (Math.abs(p.home - p.away) < 0.07) {
    tags.push({ label: "Coin flip", tone: "muted" });
  } else if (underdogProb >= 0.28 && topProb <= 0.48) {
    tags.push({ label: "Upset watch", tone: "accent" });
  }

  if (totalXg >= 3.05 || mk.over25 >= 0.62) {
    tags.push({ label: `Goal fest (${totalXg.toFixed(1)} xG)`, tone: "accent" });
  } else if (p.draw >= 0.295) {
    tags.push({ label: `Draw risk (${Math.round(p.draw * 100)}%)`, tone: "muted" });
  }

  return tags.slice(0, 2);
}
