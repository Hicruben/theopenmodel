"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface ParlayFixture {
  id: number;
  slug: string;
  date: string;
  leagueSlug: string;
  leagueName: string;
  home: string;
  away: string;
  probs: {
    home: number;
    draw: number;
    away: number;
    over25: number;
    btts: number;
  };
}

type PickKey = keyof ParlayFixture["probs"];

const PICK_LABELS: Record<PickKey, (f: ParlayFixture) => string> = {
  home: (f) => `${f.home} win`,
  draw: () => "Draw",
  away: (f) => `${f.away} win`,
  over25: () => "Over 2.5 goals",
  btts: () => "Both teams score",
};

interface SelectedLeg {
  fixture: ParlayFixture;
  pick: PickKey;
  label: string;
  prob: number;
}

export function ParlayBuilder({ fixtures }: { fixtures: ParlayFixture[] }) {
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [legs, setLegs] = useState<SelectedLeg[]>([]);
  const [bookParlayOdds, setBookParlayOdds] = useState<string>("");

  const leagues = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of fixtures) map.set(f.leagueSlug, f.leagueName);
    return Array.from(map.entries());
  }, [fixtures]);

  const visible = useMemo(
    () => (leagueFilter === "all" ? fixtures : fixtures.filter((f) => f.leagueSlug === leagueFilter)),
    [fixtures, leagueFilter]
  );

  function toggleLeg(fixture: ParlayFixture, pick: PickKey) {
    setLegs((prev) => {
      const existing = prev.find((l) => l.fixture.id === fixture.id);
      if (existing && existing.pick === pick) {
        return prev.filter((l) => l.fixture.id !== fixture.id);
      }
      const nextLeg: SelectedLeg = {
        fixture,
        pick,
        label: PICK_LABELS[pick](fixture),
        prob: fixture.probs[pick],
      };
      if (existing) {
        return prev.map((l) => (l.fixture.id === fixture.id ? nextLeg : l));
      }
      if (prev.length >= 8) return prev;
      return [...prev, nextLeg];
    });
  }

  const combinedProb = legs.length > 0 ? legs.reduce((acc, l) => acc * l.prob, 1) : 0;
  const fairOdds = combinedProb > 0.0001 ? 1 / combinedProb : 0;
  const oneInN = combinedProb > 0.0001 ? Math.round(1 / combinedProb) : 0;

  const parsedBook = Number(bookParlayOdds);
  const hasBook = bookParlayOdds.trim() !== "" && Number.isFinite(parsedBook) && parsedBook > 1.01;
  const ev = hasBook && legs.length > 0 ? combinedProb * parsedBook - 1 : null;

  return (
    <div>
      <div className="scenario-tabs" role="tablist" aria-label="Filter fixtures by league">
        <button
          type="button"
          role="tab"
          aria-selected={leagueFilter === "all"}
          onClick={() => setLeagueFilter("all")}
          style={leagueFilter === "all" ? { color: "var(--accent)", boxShadow: "inset 0 -2px 0 var(--accent)" } : undefined}
        >
          ALL LEAGUES ({fixtures.length})
        </button>
        {leagues.map(([slug, name]) => (
          <button
            key={slug}
            type="button"
            role="tab"
            aria-selected={leagueFilter === slug}
            onClick={() => setLeagueFilter(slug)}
            style={leagueFilter === slug ? { color: "var(--accent)", boxShadow: "inset 0 -2px 0 var(--accent)" } : undefined}
          >
            {name.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="parlay-grid">
        <section>
          <span className="eyebrow plain" style={{ display: "block", marginBottom: 12 }}>
            01 · Select up to 8 upcoming fixtures
          </span>
          <div className="parlay-list">
            {visible.map((f) => {
              const activeLeg = legs.find((l) => l.fixture.id === f.id);
              return (
                <div key={f.id} className="parlay-row">
                  <div className="parlay-row-head">
                    <Link href={`/match/${f.slug}/`} className="parlay-row-title">
                      {f.home} vs {f.away}
                    </Link>
                    <span className="parlay-row-meta">
                      {f.leagueName} · {f.date.slice(0, 10)}
                    </span>
                  </div>
                  <div className="parlay-picks">
                    {(["home", "draw", "away", "over25", "btts"] as PickKey[]).map((pk) => {
                      const selected = activeLeg?.pick === pk;
                      const prob = f.probs[pk];
                      const shortLabel =
                        pk === "home" ? "Home" :
                        pk === "draw" ? "Draw" :
                        pk === "away" ? "Away" :
                        pk === "over25" ? "Over 2.5" : "BTTS";
                      return (
                        <button
                          key={pk}
                          type="button"
                          onClick={() => toggleLeg(f, pk)}
                          className={`parlay-pick-btn tnum${selected ? " is-selected" : ""}`}
                        >
                          <span>{shortLabel}</span>
                          <b>{(prob * 100).toFixed(0)}%</b>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="parlay-slip">
          <div className="parlay-slip-head">
            <span className="eyebrow plain">02 · Reality check ({legs.length}/8)</span>
            {legs.length > 0 && (
              <button
                type="button"
                onClick={() => { setLegs([]); setBookParlayOdds(""); }}
                className="parlay-clear-btn"
              >
                Clear all
              </button>
            )}
          </div>

          {legs.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 14, marginBottom: 0 }}>
              Pick 2 or more outcomes on the left to calculate the true combined probability, break-even fair accumulator odds, and how often that slip actually lands.
            </p>
          ) : (
            <>
              <div className="parlay-legs">
                {legs.map((l) => (
                  <div key={l.fixture.id} className="parlay-leg">
                    <span>
                      <b className="parlay-leg-label">{l.label}</b>
                      <span className="parlay-leg-match">
                        {l.fixture.home} vs {l.fixture.away}
                      </span>
                    </span>
                    <span className="mono tnum" style={{ fontWeight: 600, fontSize: 13 }}>
                      {(l.prob * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="parlay-summary">
                <div className="parlay-kpi">
                  <span className="parlay-kpi-label">True hit probability</span>
                  <strong className="parlay-kpi-big tnum">{(combinedProb * 100).toFixed(1)}%</strong>
                </div>
                <div className="parlay-kpi">
                  <span className="parlay-kpi-label">Fair parlay odds</span>
                  <strong className="parlay-kpi-val tnum">{fairOdds.toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", paddingTop: 4, borderTop: "1px solid var(--rule)" }}>
                  At these model probabilities, this {legs.length}-leg accumulator lands roughly{" "}
                  <b style={{ color: "var(--ink)" }}>1 in {Math.max(1, oneInN)} times</b>.
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label
                  htmlFor="book-parlay-odds"
                  className="mono"
                  style={{ display: "block", fontSize: 10.5, letterSpacing: ".06em", color: "var(--muted)", marginBottom: 6 }}
                >
                  COMPARE BOOKMAKER PARLAY ODDS (DECIMAL)
                </label>
                <input
                  id="book-parlay-odds"
                  type="number"
                  step="0.05"
                  min="1.05"
                  placeholder={`Fair: ${fairOdds.toFixed(2)}`}
                  value={bookParlayOdds}
                  onChange={(e) => setBookParlayOdds(e.target.value)}
                  className="parlay-input tnum"
                />
                {ev != null && (
                  <div
                    className="mono tnum"
                    style={{
                      marginTop: 9,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: ev > 0 ? "var(--win)" : "var(--loss)",
                    }}
                  >
                    Expected value: {ev >= 0 ? "+" : ""}{(ev * 100).toFixed(1)}%{" "}
                    {ev > 0 ? "— beats fair odds" : "— below fair odds"}
                  </div>
                )}
              </div>
            </>
          )}

          <p className="foot-src" style={{ marginTop: 16 }}>
            Adding legs multiplies uncertainty rapidly — even three 70% favourites only land together 34% of the time.
          </p>
        </aside>
      </div>
    </div>
  );
}
