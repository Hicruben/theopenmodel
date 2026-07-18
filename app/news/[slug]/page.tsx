import Link from "next/link";
import { notFound } from "next/navigation";
import { allBriefs, briefBySlug, mdLite } from "@/lib/briefs";
import { clubBySlug, LEAGUES } from "@/lib/data";
import { seasonOdds } from "@/lib/season";
import { leagueClubs } from "@/lib/data";
import { pct } from "@/lib/ui";
import { Crest } from "../../components/Crest";

export function generateStaticParams() {
  return allBriefs().map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = briefBySlug(slug);
  if (!b) return {};
  return { title: b.title, description: b.body.replace(/[*[\]]/g, "").slice(0, 155) };
}

export default async function BriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = briefBySlug(slug);
  if (!b) notFound();
  const clubs = b.clubs.map((s) => clubBySlug(s)).filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AnalysisNewsArticle",
    headline: b.title,
    datePublished: b.date,
    author: { "@type": "Organization", name: "The Open Model", url: "https://theopenmodel.com" },
    isBasedOn: b.sourceLink,
  };

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="crumbs"><Link href="/">Home</Link> › <Link href="/news/">News</Link> › {b.date}</p>
      <h1 style={{ fontSize: "clamp(26px, 3.6vw, 38px)", fontWeight: 800, lineHeight: 1.15, margin: "12px 0 10px" }}>{b.title}</h1>
      <p className="updated" style={{ margin: "0 0 6px" }}>
        The Open Model · {b.date}
        {b.sourceTitle ? (
          <> · reacting to:{" "}
            <a href={b.sourceLink} target="_blank" rel="noopener nofollow">&quot;{b.sourceTitle}&quot; — {b.sourceName} ↗</a>
          </>
        ) : (
          <> · original analysis · {b.factcheck ?? "fact-checked"}</>
        )}
      </p>
      <div style={{ display: "flex", gap: 8, margin: "12px 0 20px" }}>
        {clubs.map((c) => c && (
          <Link key={c.slug} href={`/team/${c.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", border: "1px solid var(--rule)", borderRadius: 999, padding: "5px 12px 5px 6px", fontSize: 12.5, fontWeight: 600 }}>
            <Crest club={c.club} slug={c.slug} size="sm" />{c.club}
          </Link>
        ))}
      </div>
      {b.img && (
        <figure style={{ margin: "0 0 22px" }}>
          <div style={{
            display: "grid", placeItems: "center",
            border: "1px solid var(--rule)", borderRadius: 14, overflow: "hidden",
            background: b.img.startsWith("/") ? "var(--panel)" : "radial-gradient(ellipse 70% 80% at 50% 20%, rgba(255,180,58,.09), transparent 65%), var(--panel-2)",
            padding: b.img.startsWith("/") ? 0 : "26px 0 10px",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.img} alt={b.imgCaption ?? ""} style={
              b.img.startsWith("/")
                ? { width: "100%", height: "auto", display: "block" }
                : { width: 180, height: 180, objectFit: "contain", filter: "drop-shadow(0 14px 28px rgba(4,8,5,.5))" }
            } />
          </div>
          {b.imgCaption && (
            <figcaption className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>{b.imgCaption}</figcaption>
          )}
        </figure>
      )}
      <article className="prose" style={{ fontSize: 15.5, lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: mdLite(b.body) }} />

      {clubs.length > 0 && (
        <div className="panel tight" style={{ marginTop: 28 }}>
          <table className="data">
            <thead><tr><th>Club</th><th className="r">Elo</th><th className="r">Title</th><th className="r">Top 4</th><th className="r">xPts</th></tr></thead>
            <tbody>
              {clubs.map((c) => {
                if (!c) return null;
                const l = LEAGUES.find((x) => x.country === c.country);
                const o = l ? seasonOdds(l.slug, leagueClubs(l)).find((x) => x.slug === c.slug) : null;
                return (
                  <tr key={c.slug}>
                    <td><Link href={`/team/${c.slug}/`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Crest club={c.club} slug={c.slug} size="sm" />{c.club}</Link></td>
                    <td className="num r">{c.elo}</td>
                    <td className="num r">{o ? pct(o.title) : "—"}</td>
                    <td className="num r">{o ? pct(o.top4) : "—"}</td>
                    <td className="num r">{o ? o.avgPts.toFixed(0) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="foot-src" style={{ marginTop: 14 }}>
        Numbers: today&apos;s <Link href="/snapshots/">forecast snapshot</Link> (5,000 sims/league).
        Original analysis by The Open Model; the underlying news claim belongs to the credited source.
      </p>
    </main>
  );
}
