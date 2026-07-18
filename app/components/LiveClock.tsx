"use client";

import { useEffect, useState } from "react";

function timeNow() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function LiveClock({ compact = false }: { compact?: boolean }) {
  const [time, setTime] = useState("--:--:--");

  useEffect(() => {
    const tick = () => setTime(timeNow());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className={`live-clock${compact ? " is-compact" : ""}`} aria-label={`Local time ${time}`}>
      <span className="live-clock-dot" aria-hidden />
      <span className="live-clock-label">model live</span>
      <time className="tnum">{time}</time>
    </span>
  );
}
