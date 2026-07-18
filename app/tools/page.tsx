import Link from "next/link";
import { LEAGUES, leagueClubs } from "@/lib/data";
import { MatchPicker } from "../components/MatchPicker";

export const metadata = {
  title: "Football tools — compare teams and try what-if scenarios",
  description: "Simple tools to compare two clubs, change a season scenario and explore prediction data.",
};

const utilityLinks = [
  {
    index: "01",
    href: "/tools/scenario/",
    label: "What-if league table",
    title: "Change a team and see what might follow.",
    detail: "Make a team stronger or weaker, then see how its season chances change.",
    status: "Interactive",
  },
  {
    index: "02",
    href: "/matches/",
    label: "Match predictions",
    title: "See what may happen in the next matches.",
    detail: "Match times, home-win, draw and away-win chances, with simple explanations.",
    status: "Updated daily",
  },
  {
    index: "03",
    href: "/movers/",
    label: "Team form tracker",
    title: "See which teams are getting stronger.",
    detail: "Compare how club-strength ratings changed over six and twelve months.",
    status: "96 clubs",
  },
  {
    index: "04",
    href: "/snapshots/",
    label: "Saved forecasts",
    title: "See how the numbers changed over time.",
    detail: "Open a dated forecast and compare it with a newer one.",
    status: "Dated",
  },
  {
    index: "05",
    href: "/data/",
    label: "Download data",
    title: "Use the numbers in your own project.",
    detail: "Download current team-strength scores and predictions as CSV or JSON.",
    status: "Free",
  },
];

export default function Tools() {
  const clubs = LEAGUES.flatMap((league) => (
    leagueClubs(league).map((club) => ({ ...club, country: league.name }))
  )).sort((a, b) => b.elo - a.elo);

  return (
    <main className="tools-page">
      <section className="tools-hero wrap">
        <p className="tools-hero-kicker mono"><span aria-hidden /> Simple, interactive football tools</p>
        <div className="tools-hero-grid">
          <h1>Explore football with the numbers.</h1>
          <div>
            <p>Compare two clubs, try a different season scenario and see how each prediction is built.</p>
            <div className="tools-hero-facts mono">
              <span><b className="tnum">96</b> clubs</span>
              <span><b className="tnum">5</b> leagues</span>
              <span><b className="tnum">3</b> possible match results</span>
            </div>
          </div>
        </div>
      </section>

      <section className="tool-stage wrap" id="matchup">
        <MatchPicker clubs={clubs} />
      </section>

      <section className="tool-index wrap" aria-labelledby="tool-index-title">
        <header>
          <p className="tool-kicker">More ways to explore</p>
          <h2 id="tool-index-title">Football tools for every level.</h2>
        </header>
        <div className="tool-index-list">
          {utilityLinks.map((tool) => (
            <Link href={tool.href} className="tool-index-row" key={tool.href}>
              <span className="tool-index-number mono">{tool.index}</span>
              <span>
                <small className="mono">{tool.label}</small>
                <strong>{tool.title}</strong>
                <p>{tool.detail}</p>
              </span>
              <em className="mono">{tool.status}</em>
              <i aria-hidden>→</i>
            </Link>
          ))}
        </div>
      </section>

      <section className="tools-disclaimer wrap">
        <span className="mono">Useful estimates, never guarantees</span>
        <p>These tools help explain what may happen. They cannot remove uncertainty from football.</p>
        <Link href="/guide/">Read the beginner&apos;s guide ↗</Link>
      </section>
    </main>
  );
}
