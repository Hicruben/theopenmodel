"use client";
// Kickoff time in the visitor's timezone (UTC until hydration).
import { useEffect, useState } from "react";

export function Kickoff({ iso, style }: { iso: string; style?: "long" | "time" }) {
  const [txt, setTxt] = useState(() => iso.slice(0, 16).replace("T", " ") + " UTC");
  useEffect(() => {
    const d = new Date(iso);
    setTxt(style === "time"
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));
  }, [iso, style]);
  return <span className="tnum">{txt}</span>;
}

export function Countdown({ target, label }: { target: string; label: string }) {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setT(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  if (t === null) return <span className="mono tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>;
  const d = Math.floor(t / 86400000), h = Math.floor(t / 3600000) % 24,
    m = Math.floor(t / 60000) % 60, s = Math.floor(t / 1000) % 60;
  const seg = (v: number, u: string) => (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", minWidth: 44 }}>
      <b className="tnum" style={{ fontFamily: "var(--font-head)", fontSize: 26, lineHeight: 1 }}>{String(v).padStart(2, "0")}</b>
      <span className="mono" style={{ fontSize: 9, letterSpacing: ".14em", color: "var(--muted)", textTransform: "uppercase", marginTop: 4 }}>{u}</span>
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {seg(d, "days")}<span style={{ color: "var(--faint)" }}>:</span>
      {seg(h, "hrs")}<span style={{ color: "var(--faint)" }}>:</span>
      {seg(m, "min")}<span style={{ color: "var(--faint)" }}>:</span>
      {seg(s, "sec")}
    </span>
  );
}
