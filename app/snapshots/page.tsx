import Link from "next/link";
import { snapshotDates, loadSnapshot } from "@/lib/snapshots";

export const metadata = {
  title: "Saved daily forecasts",
  description: "Dated copies of the season forecast make it easy to see how the numbers changed over time.",
};

export default function Snapshots() {
  const dates = snapshotDates();
  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <p className="crumbs"><Link href="/">Home</Link> › Saved forecasts</p>
      <h1 className="pagetitle">How the forecast changed over time</h1>
      <p className="pagedesc">
        Each date below opens a saved copy of that day&apos;s season forecast. Compare two dates to see
        how real results changed each club&apos;s estimated chance of winning the league.
      </p>
      <div className="panel tight" style={{ marginTop: 22 }}>
        <table className="data">
          <thead><tr><th>Date</th><th>Title favorites on that day</th><th className="r"></th></tr></thead>
          <tbody>
            {dates.map((d) => {
              const s = loadSnapshot(d);
              const favs = s ? Object.values(s.leagues).map((rows) => rows[0]?.club).filter(Boolean).slice(0, 5).join(" · ") : "";
              return (
                <tr key={d}>
                  <td className="num"><Link href={`/snapshot/${d}/`}>{d}</Link></td>
                  <td style={{ color: "var(--ink-soft)", fontSize: 13 }}>{favs}</td>
                  <td className="r"><Link href={`/snapshot/${d}/`} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600, fontSize: 13 }}>view →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="foot-src" style={{ marginTop: 14 }}>
        Each page is rendered from the stored forecast file for that date.
      </p>
    </main>
  );
}
