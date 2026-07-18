import Link from "next/link";
import { LEAGUES, leagueClubs, flagUrl } from "@/lib/data";
import { seasonOdds } from "@/lib/season";

export const metadata = { title: "Leagues — 2026-27 season odds" };

export default function Leagues() {
  return (
    <main className="wrap">
      <section className="hero">
        <span className="eyebrow">Europe&apos;s five biggest domestic leagues</span>
        <h1>Leagues</h1>
        <p className="dek">
          We replay each season thousands of times to estimate every club&apos;s chance of finishing
          first, qualifying for Europe or dropping to a lower division. Match-by-match predictions
          begin with the 2026–27 season.
        </p>
      </section>
      <div className="grid cols-2">
        {LEAGUES.map((l) => {
          const clubs = leagueClubs(l);
          const fav = seasonOdds(l.slug, clubs)[0];
          return (
            <Link key={l.slug} href={`/league/${l.slug}/`} className="panel panel-link">
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="flag" src={flagUrl(l.flagCode, 80)} width={42} height={32} alt="" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>{l.name}</h3>
                  <p className="mono" style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 12 }}>
                    {clubs.length} clubs · most likely champion {fav.club} <b style={{ color: "var(--ink)" }}>{(fav.title * 100).toFixed(0)}%</b>
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
