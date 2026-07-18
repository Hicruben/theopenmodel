import Link from "next/link";
import type { SeasonOdds } from "@/lib/season";
import { eloHistory, tinySpark } from "@/lib/history";
import { pct, shade } from "@/lib/ui";
import { Crest } from "./Crest";

// 538-style forecast table: shaded probability cells, inline Elo sparklines.
export function ForecastTable({ odds, limit, compact }: { odds: SeasonOdds[]; limit?: number; compact?: boolean }) {
  const rows = limit ? odds.slice(0, limit) : odds;
  const xMax = Math.max(...odds.map((o) => o.avgPts));
  const xMin = Math.min(...odds.map((o) => o.avgPts));
  return (
    <table className={`data forecast${compact ? " compact" : ""}`}>
      <thead>
        <tr>
          <th style={{ width: 26 }} title="Rank by projected points">#</th>
          <th>Club</th>
          <th className="r hide-m" title="Team strength rating (Elo, from ClubElo)">Rating</th>
          {!compact && <th title="Rating trend since 2020">Trend</th>}
          <th className="r hide-m" title="Projected season points — average of 5,000 simulated seasons">Proj. pts</th>
          <th className="c" style={{ width: compact ? 62 : 82 }} title="Chance of winning the league">Wins league</th>
          <th className="c" style={{ width: compact ? 62 : 76 }} title="Chance of finishing in the top 4 (Champions League)">Top 4</th>
          <th className="c" style={{ width: compact ? 62 : 82 }} title="Chance of finishing in the bottom 3 and going down">Relegated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c, i) => {
          const hist = compact ? [] : eloHistory(c.slug);
          const d = hist.length > 1 ? tinySpark(hist) : "";
          const xw = xMax > xMin ? 18 + 82 * ((c.avgPts - xMin) / (xMax - xMin)) : 50;
          return (
            <tr key={c.slug}>
              <td className="num" style={{ color: "var(--muted)" }}>{i + 1}</td>
              <td>
                <Link href={`/team/${c.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <Crest club={c.club} slug={c.slug} size="sm" />{c.club}
                </Link>
              </td>
              <td className="num r hide-m" style={{ color: "var(--ink-soft)" }}>{c.elo}</td>
              {!compact && (
                <td className="sparkcell">
                  {d ? (
                    <svg viewBox="0 0 76 20" width={76} height={20} aria-hidden>
                      <path d={d} fill="none" stroke="var(--faint)" strokeWidth="1.3" />
                    </svg>
                  ) : null}
                </td>
              )}
              <td className="num r hide-m">
                <span className="xpts">
                  <span className="xbar" aria-hidden><i style={{ width: `${xw}%` }} /></span>
                  {c.avgPts.toFixed(0)}
                </span>
              </td>
              <td className="num" style={shade(c.title, "gold")}>{pct(c.title)}</td>
              <td className="num" style={shade(c.top4, "green")}>{pct(c.top4)}</td>
              <td className="num" style={shade(c.releg, "red")}>{pct(c.releg)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
