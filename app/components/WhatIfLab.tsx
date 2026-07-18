"use client";

// What-if lab: drag any club's Elo (transfer window, injuries, form) and watch the
// season re-simulate live in the browser.
import { useEffect, useId, useRef, useState } from "react";
import { expectedGoals, HOME_ADV_CLUB } from "@/lib/model";

interface Club { club: string; slug: string; elo: number; logo?: string }

const TARGET_SIMULATIONS = 30000;
const SIMULATIONS_PER_FRAME = 32;
const PUBLISH_INTERVAL_MS = 120;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const poisson = (lambda: number, rng: () => number) => {
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
};

export function WhatIfLab({ clubs, adjustable = 6 }: { clubs: Club[]; adjustable?: number }) {
  const labId = useId();
  const labRef = useRef<HTMLElement>(null);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [draftDeltas, setDraftDeltas] = useState<Record<string, number>>({});
  const [shares, setShares] = useState<Record<string, number>>({});
  const [sims, setSims] = useState(0);
  const [active, setActive] = useState(false);
  const state = useRef({ titles: [] as number[], n: 0, rng: mulberry32(3), lam: null as null | { H: number[][]; A: number[][] } });
  const raf = useRef(0);
  const base = useRef<Record<string, number>>({});
  const deltaKey = JSON.stringify(deltas);
  const draftDeltaKey = JSON.stringify(draftDeltas);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDeltas(draftDeltas), 180);
    return () => window.clearTimeout(timeout);
    // draftDeltaKey gives the simulator one settled update after a drag gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftDeltaKey]);

  useEffect(() => {
    const element = labRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const n = clubs.length;
    if (n < 2) {
      setSims(0);
      setShares({});
      return;
    }

    const elos = clubs.map((c) => c.elo + (deltas[c.slug] ?? 0));
    const H: number[][] = [], A: number[][] = [];
    for (let i = 0; i < n; i++) {
      H[i] = []; A[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) { H[i][j] = 0; A[i][j] = 0; continue; }
        H[i][j] = expectedGoals(elos[i], elos[j], HOME_ADV_CLUB);
        A[i][j] = expectedGoals(elos[j], elos[i], -HOME_ADV_CLUB / 2);
      }
    }

    state.current = { titles: new Array(n).fill(0), n: 0, rng: mulberry32(3), lam: { H, A } };
    setSims(0);
    let lastPublished = 0;
    const pts = new Array(n);

    const publish = () => {
      const s = state.current;
      const nextShares = Object.fromEntries(clubs.map((c, i) => [c.slug, s.titles[i] / s.n]));
      if (Object.values(deltas).every((value) => value === 0)) {
        base.current = { ...nextShares };
      }
      setSims(s.n);
      setShares(nextShares);
    };

    const tick = (time: number) => {
      const s = state.current;
      if (!s.lam) return;

      for (let b = 0; b < SIMULATIONS_PER_FRAME && s.n < TARGET_SIMULATIONS; b++) {
        pts.fill(0);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const gh = poisson(s.lam.H[i][j], s.rng), ga = poisson(s.lam.A[i][j], s.rng);
          if (gh > ga) pts[i] += 3; else if (gh < ga) pts[j] += 3; else { pts[i]++; pts[j]++; }
        }
        let bestPoints = pts[0];
        const tied = [0];
        for (let i = 1; i < n; i++) {
          if (pts[i] > bestPoints) {
            bestPoints = pts[i];
            tied.splice(0, tied.length, i);
          } else if (pts[i] === bestPoints) {
            tied.push(i);
          }
        }
        const champion = tied[Math.floor(s.rng() * tied.length)];
        s.titles[champion]++; s.n++;
      }

      if (time - lastPublished >= PUBLISH_INTERVAL_MS || s.n === TARGET_SIMULATIONS) {
        publish();
        lastPublished = time;
      }
      if (s.n < TARGET_SIMULATIONS) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, clubs, deltaKey]);

  const shown = clubs.slice(0, adjustable);
  const hasAdjustments = shown.some((c) => (draftDeltas[c.slug] ?? 0) !== 0);
  const isRunning = active && clubs.length > 1 && sims < TARGET_SIMULATIONS;
  const maxShare = Math.max(...shown.map((c) => shares[c.slug] ?? 0), 0.01);
  const ranked = [...shown].sort((a, b) => (shares[b.slug] ?? 0) - (shares[a.slug] ?? 0));

  return (
    <section ref={labRef} className="whatif-lab" aria-labelledby={`${labId}-title`}>
      <header className="whatif-header">
        <div className="whatif-heading">
          <p className="whatif-kicker">What-if season simulator</p>
          <h3 id={`${labId}-title`} className="whatif-title">Change a team&apos;s strength. Watch its season chance move.</h3>
          <p className="whatif-intro">
            Move a slider to make a team stronger or weaker. Every change replays 30,000 possible seasons.
          </p>
        </div>

        <div className="whatif-status" data-running={isRunning ? "true" : "false"}>
          <span className="whatif-status-dot" aria-hidden="true" />
          <span className="whatif-status-copy" aria-live="polite">
            {!active ? "Ready to begin" : isRunning ? "Replaying seasons" : "New estimates ready"}
          </span>
          <strong className="whatif-sim-count tnum">
            {sims.toLocaleString("en-US")}
            <span> / {TARGET_SIMULATIONS.toLocaleString("en-US")}</span>
          </strong>
          <progress
            className="whatif-sim-progress"
            max={TARGET_SIMULATIONS}
            value={sims}
            aria-label="Simulation progress"
          >
            {Math.round((sims / TARGET_SIMULATIONS) * 100)}%
          </progress>
        </div>
      </header>

      <div className="whatif-workspace">
        <div className="whatif-controls">
          <div className="whatif-section-head">
            <div>
              <p className="whatif-section-label">Inputs</p>
              <h4>Team strength controls</h4>
            </div>
            <button
              type="button"
              className="whatif-reset"
              disabled={!hasAdjustments}
              onClick={() => {
                setDraftDeltas({});
                setDeltas({});
              }}
            >
              Reset changes
            </button>
          </div>

          <div className="whatif-control-list">
            {shown.map((c) => {
              const d = draftDeltas[c.slug] ?? 0;
              const controlId = `${labId}-${c.slug}`;
              return (
                <div className="whatif-control" key={c.slug}>
                  <div className="whatif-control-meta">
                    <label className="whatif-club" htmlFor={controlId}>
                      {c.logo && /* eslint-disable-next-line @next/next/no-img-element */
                        <img className="whatif-club-logo" src={c.logo} width={22} height={22} alt="" />}
                      <span>{c.club}</span>
                    </label>
                    <span className="whatif-rating mono tnum">Strength {c.elo + d}</span>
                  </div>
                  <input
                    id={controlId}
                    className="whatif-range"
                    type="range"
                    min={-150}
                    max={150}
                    step={10}
                    value={d}
                    aria-describedby={`${controlId}-scale`}
                    aria-valuetext={d === 0 ? "Current team strength" : `${d > 0 ? "plus " : "minus "}${Math.abs(d)} strength points`}
                    onChange={(event) => setDraftDeltas((previous) => ({
                      ...previous,
                      [c.slug]: Number(event.target.value),
                    }))}
                  />
                  <div id={`${controlId}-scale`} className="whatif-range-scale">
                    <span>-150</span>
                    <output className="whatif-range-output tnum" htmlFor={controlId}>
                      {d === 0 ? "Current strength" : `${d > 0 ? "+" : ""}${d} strength`}
                    </output>
                    <span>+150</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="whatif-results">
          <div className="whatif-section-head">
            <div>
              <p className="whatif-section-label">Updated result</p>
              <h4>Chance of finishing first</h4>
            </div>
            <span className="whatif-result-unit mono">30K seasons</span>
          </div>

          <ol className="whatif-results-list">
            {ranked.map((c, index) => {
              const p = shares[c.slug] ?? 0;
              const baseline = base.current[c.slug];
              const diff = baseline === undefined ? 0 : p - baseline;
              const changeClass = Math.abs(diff) < 0.004 ? "is-flat" : diff > 0 ? "is-up" : "is-down";
              const showChange = hasAdjustments && baseline !== undefined && sims > 0;
              return (
                <li className="whatif-result" key={c.slug}>
                  <span className="whatif-rank mono tnum">{String(index + 1).padStart(2, "0")}</span>
                  <span className="whatif-result-club">{c.club}</span>
                  <strong className="whatif-probability tnum">{(p * 100).toFixed(1)}%</strong>
                  <span className={`whatif-change mono tnum ${showChange ? changeClass : "is-flat"}`}>
                    {showChange
                      ? `${diff > 0 ? "+" : ""}${(diff * 100).toFixed(1)} percentage points`
                      : "current"}
                  </span>
                  <progress
                    className="whatif-result-meter"
                    max={maxShare}
                    value={p}
                    aria-label={`${c.club} title probability ${(p * 100).toFixed(1)} percent`}
                  >
                    {(p * 100).toFixed(1)}%
                  </progress>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <p className="whatif-note">
        These changes are imaginary. The tool shows how a different strength rating would affect the season estimate.
      </p>
    </section>
  );
}
