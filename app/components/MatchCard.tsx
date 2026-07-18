import Link from "next/link";
import type { Fixture } from "@/lib/fixtures";
import { matchProb } from "@/lib/model";
import { Kickoff } from "./Kickoff";

export function MatchCard({ f }: { f: Fixture }) {
  const p = matchProb(f.home.elo, f.away.elo);
  return (
    <Link href={`/match/${f.slug}/`} className="matchcard">
      <div className="mc-top mono">
        <span>{f.league.name} · {f.round.replace("Regular Season - ", "Matchday ")}</span>
        <Kickoff iso={f.date} />
      </div>
      <div className="mc-teams">
        <span className="mc-team">
          {f.home.logo && /* eslint-disable-next-line @next/next/no-img-element */
            <img src={f.home.logo} width={24} height={24} alt="" style={{ objectFit: "contain" }} />}
          {f.home.club}
        </span>
        <span className="mc-vs mono">vs</span>
        <span className="mc-team away">
          {f.away.club}
          {f.away.logo && /* eslint-disable-next-line @next/next/no-img-element */
            <img src={f.away.logo} width={24} height={24} alt="" style={{ objectFit: "contain" }} />}
        </span>
      </div>
      <div className="probbar" style={{ height: 8 }} aria-hidden>
        <span className="h" style={{ width: `${(p.home * 100).toFixed(1)}%` }} />
        <span className="d" style={{ width: `${(p.draw * 100).toFixed(1)}%` }} />
        <span className="a" style={{ width: `${(p.away * 100).toFixed(1)}%` }} />
      </div>
      <div className="mc-odds mono tnum" aria-label="Estimated chances for each result">
        <span><small>Home win</small><b style={{ color: "var(--accent)" }}>{(p.home * 100).toFixed(0)}%</b></span>
        <span><small>Draw</small><b style={{ color: "var(--ink-soft)" }}>{(p.draw * 100).toFixed(0)}%</b></span>
        <span><small>Away win</small><b style={{ color: "var(--loss)" }}>{(p.away * 100).toFixed(0)}%</b></span>
      </div>
    </Link>
  );
}
