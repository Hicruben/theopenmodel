import Link from "next/link";
import { notFound } from "next/navigation";
import { snapshotDates, loadSnapshot, previousSnapshot } from "@/lib/snapshots";
import { LEAGUES, flagUrl } from "@/lib/data";
import { pct, shade } from "@/lib/ui";
import { Crest } from "../../components/Crest";

export function generateStaticParams() {
  return snapshotDates().map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return {
    title: `Saved forecast — ${date}`,
    description: `A saved season forecast from ${date}: title, top-four and relegation chances for all five leagues.`,
  };
}

export default async function SnapshotPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const snap = loadSnapshot(date);
  if (!snap) notFound();
  const prev = previousSnapshot(date);

  return (
    <main className="wrap" style={{ maxWidth: 960 }}>
      <p className="crumbs"><Link href="/">Home</Link> › <Link href="/snapshots/">Saved forecasts</Link> › {date}</p>
      <h1 className="pagetitle">Forecast as of {date}</h1>
      <p className="pagedesc">
        This page uses the stored forecast file for {date}.{" "}
        {prev && <>Changes are shown against the previous saved date, {prev.date}.</>}
      </p>
      <p className="updated" style={{ margin: "6px 0 10px" }}>generated {snap.generatedAt.slice(0, 16).replace("T", " ")} UTC · 5,000 sims/league</p>

      {LEAGUES.map((l) => {
        const rows = snap.leagues[l.slug] ?? [];
        const prevRows = prev?.leagues[l.slug] ?? [];
        const prevTitle = new Map(prevRows.map((r) => [r.slug, r.title]));
        return (
          <section key={l.slug}>
            <div className="lg-head" style={{ marginTop: 30 }}>
              <h2>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="flag" src={flagUrl(l.flagCode)} width={20} height={15} alt="" />
                {l.name}
              </h2>
              <Link href={`/league/${l.slug}/`}>live forecast →</Link>
            </div>
            <div className="panel tight" style={{ overflowX: "auto" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 26 }}>#</th><th>Club</th>
                    <th className="r">Elo</th><th className="r">xPts</th>
                    <th className="c">Title</th><th className="c">Δ</th>
                    <th className="c">Top 4</th><th className="c">Releg.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => {
                    const was = prevTitle.get(r.slug);
                    const d = was === undefined ? null : r.title - was;
                    return (
                      <tr key={r.slug}>
                        <td className="num" style={{ color: "var(--muted)" }}>{i + 1}</td>
                        <td><Link href={`/team/${r.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <Crest club={r.club} slug={r.slug} size="sm" />{r.club}</Link></td>
                        <td className="num r" style={{ color: "var(--muted)" }}>{r.elo}</td>
                        <td className="num r">{r.xPts.toFixed(0)}</td>
                        <td className="num" style={shade(r.title, "gold")}>{pct(r.title)}</td>
                        <td className="num c" style={{ fontSize: 11, color: d === null || Math.abs(d) < 0.002 ? "var(--faint)" : d > 0 ? "var(--accent)" : "var(--loss)" }}>
                          {d === null || Math.abs(d) < 0.002 ? "—" : `${d > 0 ? "▲" : "▼"}${Math.abs(d * 100).toFixed(1)}`}
                        </td>
                        <td className="num" style={shade(r.top4, "green")}>{pct(r.top4)}</td>
                        <td className="num" style={shade(r.releg, "red")}>{pct(r.releg)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <p className="foot-src" style={{ marginTop: 16 }}>
        Top eight clubs per league are shown. This page is generated from the saved data file for {date}.
      </p>
    </main>
  );
}
