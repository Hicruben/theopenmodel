"use client";

import { useState } from "react";

export interface MarketOption {
  id: string;
  label: string;
  prob: number; // 0..1
}

type OddsFormat = "decimal" | "american" | "fractional";

function formatOdds(prob: number, fmt: OddsFormat): string {
  if (!Number.isFinite(prob) || prob <= 0.001) return "—";
  const dec = 1 / prob;
  if (fmt === "decimal") return dec.toFixed(2);
  if (fmt === "american") {
    if (dec >= 2) return `+${Math.round((dec - 1) * 100)}`;
    return `${Math.round(-100 / (dec - 1))}`;
  }
  const net = dec - 1;
  const denoms = [1, 2, 4, 5, 8, 10, 20];
  let bestNum = Math.max(1, Math.round(net * 10));
  let bestDen = 10;
  let bestErr = Infinity;
  for (const d of denoms) {
    const n = Math.max(1, Math.round(net * d));
    const err = Math.abs(n / d - net);
    if (err < bestErr) {
      bestErr = err;
      bestNum = n;
      bestDen = d;
    }
  }
  return `${bestNum}/${bestDen}`;
}

export function MatchOddsChecker({
  markets,
  defaultId,
}: {
  markets: MarketOption[];
  defaultId?: string;
}) {
  const [fmt, setFmt] = useState<OddsFormat>("decimal");
  const [selectedId, setSelectedId] = useState<string>(defaultId || markets[0]?.id || "");
  const [bookOddsInput, setBookOddsInput] = useState<string>("");

  const active = markets.find((m) => m.id === selectedId) || markets[0];
  if (!active) return null;

  const fairDec = active.prob > 0.001 ? 1 / active.prob : 0;
  const parsedBook = Number(bookOddsInput);
  const hasBook = bookOddsInput.trim() !== "" && Number.isFinite(parsedBook) && parsedBook > 1.01;

  const impliedProb = hasBook ? 1 / parsedBook : null;
  const edge = impliedProb != null ? active.prob - impliedProb : null;
  const ev = hasBook ? active.prob * parsedBook - 1 : null;
  const fullKelly = hasBook && parsedBook > 1 ? (active.prob * parsedBook - 1) / (parsedBook - 1) : 0;
  const halfKelly = Math.max(0, Math.min(0.05, fullKelly * 0.5));

  return (
    <section className="panel" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span className="eyebrow plain">Fair odds &amp; value checker</span>
        <div className="odds-seg" role="group" aria-label="Odds format">
          {(["decimal", "american", "fractional"] as OddsFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFmt(f)}
              className={fmt === f ? "is-active" : undefined}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: "10px 0 14px" }}>
        Fair odds are simply <span className="mono">1 / probability</span> with zero bookmaker margin. Select an outcome and enter any market price to check mathematical edge and expected value.
      </p>

      <div className="odds-markets">
        {markets.map((m) => {
          const isSelected = m.id === active.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={`odds-market-btn${isSelected ? " is-selected" : ""}`}
            >
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>
                {m.label}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                <strong className="mono tnum" style={{ fontSize: 17, color: isSelected ? "var(--accent)" : "var(--ink)" }}>
                  {formatOdds(m.prob, fmt)}
                </strong>
                <span className="mono tnum" style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                  {(m.prob * 100).toFixed(1)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid var(--rule)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          alignItems: "end",
        }}
      >
        <div>
          <label
            htmlFor="bookmaker-odds-input"
            className="mono"
            style={{ display: "block", fontSize: 10.5, letterSpacing: ".05em", color: "var(--muted)", marginBottom: 6 }}
          >
            COMPARE BOOKMAKER DECIMAL ODDS FOR &ldquo;{active.label.toUpperCase()}&rdquo;
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              id="bookmaker-odds-input"
              type="number"
              step="0.01"
              min="1.02"
              placeholder={`Fair: ${fairDec.toFixed(2)}`}
              value={bookOddsInput}
              onChange={(e) => setBookOddsInput(e.target.value)}
              className="parlay-input tnum"
              style={{ width: 150 }}
            />
            {bookOddsInput && (
              <button
                type="button"
                onClick={() => setBookOddsInput("")}
                className="parlay-clear-btn"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {hasBook && impliedProb != null && edge != null && ev != null ? (
          <div className={`odds-ev-box${ev > 0 ? " is-pos" : ""}`}>
            <div>
              <div className="mono" style={{ fontSize: 10, letterSpacing: ".05em", color: "var(--muted)" }}>IMPLIED / EDGE</div>
              <div className="mono tnum" style={{ fontSize: 14, fontWeight: 600, color: edge >= 0 ? "var(--win)" : "var(--loss)" }}>
                {(impliedProb * 100).toFixed(1)}% ({edge >= 0 ? "+" : ""}{(edge * 100).toFixed(1)}%)
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 10, letterSpacing: ".05em", color: "var(--muted)" }}>EXPECTED VALUE</div>
              <div className="mono tnum" style={{ fontSize: 14, fontWeight: 700, color: ev > 0 ? "var(--win)" : "var(--loss)" }}>
                {ev >= 0 ? "+" : ""}{(ev * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 10, letterSpacing: ".05em", color: "var(--muted)" }}>HALF-KELLY</div>
              <div className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>
                {ev > 0 ? `${(halfKelly * 100).toFixed(2)}%` : "0% (Pass)"}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Enter a bookmaker&apos;s decimal price (e.g. <b className="mono tnum" style={{ color: "var(--ink)" }}>{(fairDec * 1.05).toFixed(2)}</b>) to see whether the odds beat the model&apos;s break-even price of <b className="mono tnum" style={{ color: "var(--accent)" }}>{fairDec.toFixed(2)}</b>.
          </div>
        )}
      </div>

      <p className="foot-src" style={{ marginTop: 12 }}>
        For mathematical comparison only. Model probabilities are estimates and carry uncertainty; positive EV does not guarantee a winning outcome.
      </p>
    </section>
  );
}
