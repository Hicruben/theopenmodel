"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

interface Club {
  club: string;
  slug: string;
  elo: number;
  logo?: string;
}

interface Hero3DClientProps {
  clubs: Club[];
  leagueName: string;
}

function FieldBoot() {
  return (
    <div className="hero3d-wrap" style={{ display: "grid", minHeight: 430, placeItems: "center" }}>
      <span className="mono" style={{ color: "#c9bfa4", fontSize: 11, letterSpacing: ".08em" }}>
        LOADING TEAM STRENGTH…
      </span>
    </div>
  );
}

const Hero3D = dynamic(() => import("./Hero3D").then((module) => module.Hero3D), {
  ssr: false,
  loading: FieldBoot,
});

function LightweightField({ clubs, leagueName, quiet = false }: Hero3DClientProps & { quiet?: boolean }) {
  const leaders = useMemo(() => {
    const sorted = [...clubs].sort((a, b) => b.elo - a.elo).slice(0, 4);
    const maxElo = sorted[0]?.elo ?? 1;
    return sorted.map((club) => ({
      ...club,
      strength: Math.max(18, Math.round(Math.exp((club.elo - maxElo) / 220) * 100)),
    }));
  }, [clubs]);

  return (
    <div
      aria-label={`${leagueName} model strength field`}
      style={{
        background: "radial-gradient(circle at 78% 15%, rgba(255,180,58,.055), transparent 38%), #0a130c",
        border: "1px solid rgba(201,191,164,.18)",
        borderRadius: 8,
        boxShadow: "inset 0 1px 0 rgba(248,241,226,.035)",
        minHeight: 286,
        overflow: "hidden",
        padding: "18px 16px 16px",
        position: "relative",
      }}
    >
      <div aria-hidden style={{
        backgroundImage: "linear-gradient(rgba(201,191,164,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(201,191,164,.055) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
        inset: 0,
        maskImage: "linear-gradient(to bottom, black, transparent 92%)",
        pointerEvents: "none",
        position: "absolute",
      }} />

      <div style={{
        alignItems: "center",
        color: "#c9bfa4",
        display: "flex",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        justifyContent: "space-between",
        letterSpacing: ".08em",
        marginBottom: 24,
        position: "relative",
      }}>
        <span style={{ color: "#f5efe0" }}>{leagueName.toUpperCase()} / MODEL FIELD</span>
        <span style={{ alignItems: "center", display: "inline-flex", gap: 7 }}>
          <i aria-hidden style={{ background: "#ffb43a", boxShadow: quiet ? "none" : "0 0 8px rgba(255,180,58,.3)", height: 6, width: 6 }} />
          {quiet ? "QUIET MODE" : "LIVE FEED"}
        </span>
      </div>

      <div style={{ display: "grid", gap: 13, position: "relative" }}>
        {leaders.map((club, index) => (
          <div key={club.slug} style={{ display: "grid", gap: 7, gridTemplateColumns: "minmax(92px, 1fr) 1.6fr 38px", alignItems: "center" }}>
            <span style={{ color: index === 0 ? "#f5efe0" : "#c9bfa4", fontFamily: "var(--font-body)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {club.club}
            </span>
            <span style={{ background: "rgba(201,191,164,.09)", borderRadius: 99, height: 5, overflow: "hidden" }}>
              <i style={{
                background: index === 0 ? "#ffb43a" : index === 1 ? "#f5efe0" : "#87795c",
                boxShadow: "none",
                display: "block",
                height: "100%",
                width: `${club.strength}%`,
              }} />
            </span>
            <b style={{ color: index === 0 ? "#ffb43a" : "#c9bfa4", fontFamily: "var(--font-mono)", fontSize: 10, textAlign: "right" }}>
              {club.elo}
            </b>
          </div>
        ))}
      </div>

      <div style={{ bottom: 13, color: "#87795c", fontFamily: "var(--font-mono)", fontSize: 9, left: 16, letterSpacing: ".06em", position: "absolute" }}>
        RELATIVE MODEL STRENGTH · ELO SIGNAL
      </div>
    </div>
  );
}

export function Hero3DClient(props: Hero3DClientProps) {
  const [mode, setMode] = useState<"checking" | "field" | "light">("checking");
  const [quiet, setQuiet] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 760px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setQuiet(reduced.matches);
      setMode(wide.matches && !reduced.matches ? "field" : "light");
    };
    update();
    wide.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  if (mode === "field") return <Hero3D {...props} />;
  return <LightweightField {...props} quiet={mode === "checking" || quiet} />;
}
