import type { MetadataRoute } from "next";
export const dynamic = "force-static";
import { LEAGUES, leagueClubs } from "@/lib/data";
import { allFixtures, fixtureDates } from "@/lib/fixtures";
import { allBriefs } from "@/lib/briefs";

const SITE = "https://theopenmodel.com";
const INDEX_WINDOW_DAYS = 30;

// Sitemap mirrors the indexation policy: core pages + teams + only near-term matches.
// Far-future match pages exist for users but are noindex and stay out of the sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // The whole site re-exports every day via CI, so forecast-driven pages genuinely
  // change daily — surface that with lastModified so crawlers revisit the fresh numbers.
  const core: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1, lastModified: now },
    { url: `${SITE}/matches/`, changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: `${SITE}/scores/`, changeFrequency: "daily", priority: 0.85, lastModified: now },
    { url: `${SITE}/tools/`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/tools/scenario/`, changeFrequency: "weekly", priority: 0.75 },
    { url: `${SITE}/leagues/`, changeFrequency: "weekly", priority: 0.7, lastModified: now },
    { url: `${SITE}/movers/`, changeFrequency: "weekly", priority: 0.7, lastModified: now },
    { url: `${SITE}/best-bets/`, changeFrequency: "daily", priority: 0.8, lastModified: now },
    { url: `${SITE}/data/`, changeFrequency: "weekly", priority: 0.6, lastModified: now },
    { url: `${SITE}/snapshots/`, changeFrequency: "daily", priority: 0.6, lastModified: now },
    { url: `${SITE}/guide/`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/methodology/`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/about/`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/privacy/`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/record/`, changeFrequency: "daily", priority: 0.8, lastModified: now },
  ];
  const leagues = LEAGUES.flatMap((l) => [
    { url: `${SITE}/league/${l.slug}/`, changeFrequency: "daily" as const, priority: 0.9, lastModified: now },
    { url: `${SITE}/league/${l.slug}/table/`, changeFrequency: "daily" as const, priority: 0.85, lastModified: now },
    { url: `${SITE}/league/${l.slug}/fixtures/`, changeFrequency: "daily" as const, priority: 0.7, lastModified: now },
    { url: `${SITE}/league/${l.slug}/scorers/`, changeFrequency: "weekly" as const, priority: 0.65 },
  ]);
  const teams = LEAGUES.flatMap((l) => leagueClubs(l)).map((c) => ({
    url: `${SITE}/team/${c.slug}/`, changeFrequency: "daily" as const, priority: 0.6, lastModified: now,
  }));
  const news: MetadataRoute.Sitemap = [
    { url: `${SITE}/news/`, changeFrequency: "daily", priority: 0.8, lastModified: now },
    ...allBriefs().map((b) => ({ url: `${SITE}/news/${b.slug}/`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
  const matches = allFixtures()
    .filter((f) => {
      const dt = new Date(f.date).getTime() - now.getTime();
      return dt < INDEX_WINDOW_DAYS * 86400_000 && dt > -3 * 86400_000;
    })
    .map((f) => ({
      url: `${SITE}/match/${f.slug}/`, changeFrequency: "daily" as const, priority: 0.8, lastModified: now,
    }));
  // Match-centre by date: only near-term days (same window as match pages).
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + INDEX_WINDOW_DAYS * 86400_000).toISOString().slice(0, 10);
  const matchDates = fixtureDates()
    .filter((d) => d >= today && d <= horizon)
    .map((d) => ({ url: `${SITE}/matches/${d}/`, changeFrequency: "daily" as const, priority: 0.75, lastModified: now }));
  return [...core, ...leagues, ...news, ...teams, ...matches, ...matchDates];
}
