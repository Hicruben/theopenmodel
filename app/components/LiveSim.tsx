"use client";
// The model, running live in the browser: full-league Monte Carlo with a racing counter
// and converging title bars. This is the brand — you can literally watch it work.
import { useEffect, useRef, useState } from "react";
import { expectedGoals, HOME_ADV_CLUB } from "@/lib/model";

interface Club { club: string; slug: string; elo: number; logo?: string }

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function LiveSim({ clubs, leagueName, compact }: { clubs: Club[]; leagueName: string; compact?: boolean }) {
  const [sims, setSims] = useState(0);
  const [rows, setRows] = useState<{ club: Club; p: number }[]>([]);
  const state = useRef<{ titles: number[]; n: number; rng: () => number; lam: number[][][] } | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const n = clubs.length;
    const lamH: number[][] = [], lamA: number[][] = [];
    for (let i = 0; i < n; i++) {
      lamH[i] = []; lamA[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) { lamH[i][j] = 0; lamA[i][j] = 0; continue; }
        lamH[i][j] = expectedGoals(clubs[i].elo, clubs[j].elo, HOME_ADV_CLUB);
        lamA[i][j] = expectedGoals(clubs[j].elo, clubs[i].elo, -HOME_ADV_CLUB / 2);
      }
    }
    state.current = { titles: new Array(n).fill(0), n: 0, rng: mulberry32(Date.now() & 0xffff), lam: [lamH, lamA] };

    const pts = new Array(n);
    const poisson = (lambda: number, rng: () => number) => {
      const L = Math.exp(-lambda); let k = 0, p = 1;
      do { k++; p *= rng(); } while (p > L);
      return k - 1;
    };

    const tick = () => {
      const s = state.current!;
      const BATCH = s.n < 2000 ? 25 : 60;
      for (let b = 0; b < BATCH; b++) {
        pts.fill(0);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const gh = poisson(s.lam[0][i][j], s.rng), ga = poisson(s.lam[1][i][j], s.rng);
          if (gh > ga) pts[i] += 3; else if (gh < ga) pts[j] += 3; else { pts[i]++; pts[j]++; }
        }
        let best = 0;
        for (let i = 1; i < n; i++) if (pts[i] > pts[best]) best = i;
        s.titles[best]++; s.n++;
      }
      setSims(s.n);
      setRows(clubs.map((c, i) => ({ club: c, p: s.titles[i] / s.n }))
        .sort((a, b) => b.p - a.p).slice(0, 6));
      if (s.n < 100000) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const max = rows[0]?.p ?? 1;
  const shown = compact ? rows.slice(0, 5) : rows;
  return (
    <div className={compact ? undefined : "panel livesim"}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span className="eyebrow"><span className="pulse" aria-hidden />{compact ? "Live" : "Model running live"}</span>
        <span className="mono tnum" style={{ fontSize: compact ? 11 : 12, color: "var(--muted)" }}>
          <b style={{ color: "var(--ink)", fontSize: compact ? 13 : 15 }}>{sims.toLocaleString("en-US")}</b> {compact ? "seasons" : `${leagueName} seasons simulated in your browser`}
        </span>
      </div>
      <div style={{ marginTop: compact ? 10 : 14, display: "grid", gap: compact ? 6 : 8 }}>
        {shown.map(({ club, p }) => (
          <div key={club.slug} style={{ display: "grid", gridTemplateColumns: `${compact ? "116px" : "150px"} 1fr 48px`, alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {club.logo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={club.logo} width={18} height={18} alt="" style={{ objectFit: "contain" }} />
              ) : null}
              {club.club}
            </span>
            <span className="simbar"><i style={{ width: `${(p / max) * 100}%` }} /></span>
            <span className="num tnum r" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, textAlign: "right", fontWeight: 600 }}>
              {(p * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      {!compact && (
        <p className="foot-src" style={{ marginTop: 12 }}>
          Same code as the published forecast — Elo → Dixon-Coles goals → full double round-robin.
          Open source, run before your eyes.
        </p>
      )}
    </div>
  );
}
