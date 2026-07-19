import Link from "next/link";
import { upcomingFixtures, nextFixtureDate } from "@/lib/fixtures";
import { MatchCard } from "../components/MatchCard";

export const metadata = {
  title: "Upcoming matches and easy-to-read predictions",
  description: "The estimated chance of a home win, draw or away win for upcoming matches in Europe's top five leagues.",
};

export default function Matches() {
  const centreDate = nextFixtureDate();
  const fx = upcomingFixtures(48);
  const byDate = new Map<string, typeof fx>();
  for (const f of fx) {
    const d = f.date.slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(f);
  }

  return (
    <main className="wrap">
      <h1 className="pagetitle" style={{ marginTop: 26 }}>Upcoming matches</h1>
      <p className="pagedesc" style={{ marginBottom: 8 }}>
        Every match has three possible results: the home team wins, the teams draw, or the away team wins.
        The percentages add to 100% and show what may happen, not what will happen.{" "}
        <Link href="/guide/">Read the simple guide →</Link>
      </p>
      <p style={{ margin: "4px 0 0" }}>
        <Link href={`/matches/${centreDate}/`} className="btn" style={{ fontSize: 12.5, padding: "9px 16px" }}>
          Open match centre — browse by date →
        </Link>
      </p>
      {[...byDate.entries()].map(([date, list]) => (
        <section key={date} data-reveal>
          <div className="lg-head" style={{ marginTop: 30 }}>
            <h2 className="tnum">{new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
            <span className="updated">{list.length} match{list.length > 1 ? "es" : ""}</span>
          </div>
          <div className="grid cols-3">
            {list.map((f) => <MatchCard key={f.id} f={f} />)}
          </div>
        </section>
      ))}
    </main>
  );
}
