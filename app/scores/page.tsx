import Link from "next/link";
import { portalFixtures, portalSnapshot } from "@/lib/portal";
import { LiveScores } from "../components/LiveScores";

// This page used to promise live, self-updating scores. Since the site moved to static
// hosting the underlying feed is rebuilt once a day, so that promise was false — and a
// site whose whole argument is that its numbers can be trusted cannot afford a page that
// overstates its own freshness. It now says what it actually is.
export const metadata = {
  title: "Football results & the model's pre-match call",
  description: "Recent results across the top five leagues, each shown next to the probability the model published before kickoff. Refreshed once a day — for minute-by-minute scores, use a dedicated live-score app.",
};

export default function ScoresPage() {
  const snap = portalSnapshot();
  const initial = snap.provider === "api-football" ? portalFixtures() : [];
  const initialAsOf = snap.provider === "api-football" ? snap.asOf : null;

  return (
    <main className="wrap">
      <p className="crumbs"><Link href="/">Home</Link> › Results</p>
      <h1 className="pagetitle" style={{ marginTop: 6 }}>Results, next to what we predicted</h1>
      <p className="pagedesc">
        Recent scores across the top five leagues, each one beside the probability the model
        published before kickoff. <b>This page refreshes once a day, not minute by minute</b> — if
        you want live scores, a dedicated app will serve you better. What you get here instead is
        every result marked against a call that was already on the record: the{" "}
        <Link href="/matches/">match centre</Link> has the upcoming ones, and the{" "}
        <Link href="/record/">track record</Link> scores them all.
      </p>
      <LiveScores initial={initial} initialAsOf={initialAsOf} />
    </main>
  );
}
