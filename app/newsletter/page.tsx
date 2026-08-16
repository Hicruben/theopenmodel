import Link from "next/link";
import { NewsletterSignup } from "../components/NewsletterSignup";
import { clubRecord } from "@/lib/record";

export const metadata = {
  title: "The weekly football model email — one issue every Tuesday",
  description:
    "A free weekly email from an open-source football model: the biggest probability swing of the week, one chart, and the prediction the model got most wrong. No betting tips.",
};

export default function NewsletterPage() {
  const rec = clubRecord();

  return (
    <main className="wrap prose" style={{ maxWidth: 760 }}>
      <p className="crumbs"><Link href="/">Home</Link> › Newsletter</p>
      <h1 className="pagetitle">One email a week, and one of the three things in it is a mistake</h1>
      <p className="pagedesc">
        Most football prediction newsletters tell you what they got right. This one has a permanent
        slot for what the model got wrong, because a forecast you can&apos;t check isn&apos;t worth
        reading.
      </p>

      <div style={{ margin: "26px 0" }}>
        <NewsletterSignup source="newsletter-page" title="Subscribe" />
      </div>

      <h2>What arrives on Tuesday</h2>
      <p>Every issue has the same three parts, so you always know what you&apos;re getting:</p>
      <ol>
        <li>
          <b>The biggest swing.</b> Which team&apos;s title, top-four or relegation chance moved most
          over the weekend, and what moved it.
        </li>
        <li>
          <b>One chart.</b> A single picture of where a race actually stands — not a table you have
          to decode.
        </li>
        <li>
          <b>The worst miss.</b> The prediction the model was most confident about and still got
          wrong, named and explained.
        </li>
      </ol>

      <h2>What it isn&apos;t</h2>
      <p>
        No betting tips, no affiliate links, no &quot;lock of the week&quot;. The model doesn&apos;t
        claim an edge over bookmakers and nothing here is advice. It is a statistical forecast that
        publishes before kickoff and gets marked afterwards — you can read{" "}
        <Link href="/methodology/">how it works</Link> and download{" "}
        <Link href="/data/">every prediction it has ever made</Link>.
      </p>

      <h2>Why the misses are the headline</h2>
      <p>
        A model that only shows its wins is indistinguishable from one that deletes its losses. The{" "}
        <Link href="/record/">public record</Link> scores every call
        {rec.n > 0 ? ` — ${rec.hits} of ${rec.n} correct so far this season, right and wrong both kept` : " from the first matchday of the season"}
        , and the underlying rows are open data. The newsletter is the same discipline, weekly, in
        your inbox.
      </p>

      <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
        Free, one email a week, unsubscribe in one click. The list is hosted by Kit and the address
        is never shared — see the <Link href="/privacy/">privacy page</Link>. Prefer instant
        updates? The same forecasts go out on{" "}
        <a href="https://t.me/world26ai">Telegram</a>.
      </p>
    </main>
  );
}
