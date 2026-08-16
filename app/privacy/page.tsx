import Link from "next/link";

export const metadata = {
  title: "Privacy and analytics",
  description: "How The Open Model measures site use and handles analytics data.",
};

export default function Privacy() {
  return (
    <main className="wrap prose">
      <p className="crumbs"><Link href="/">Home</Link> › Privacy &amp; analytics</p>
      <h1 className="pagetitle">Privacy &amp; analytics</h1>
      <p className="pagedesc">
        A short explanation of what we measure, why we measure it and what we do not collect.
      </p>

      <h2>Anonymous site statistics</h2>
      <p>
        The Open Model uses a self-hosted Umami analytics service to understand which pages are
        useful, how visitors find the site and whether the experience works across common browsers
        and devices. Analytics are used to improve the site, not to build advertising profiles.
      </p>

      <h2>What is measured</h2>
      <p>
        We record aggregate page views, referral sources, browser and device categories, and
        approximate country-level location. The analytics setup does not place analytics cookies,
        and we do not sell analytics data or share it with advertising networks.
      </p>

      <h2>External links and data</h2>
      <p>
        News links, GitHub, Telegram and other external services have their own privacy policies.
        Football data shown here may come from the providers named on the relevant page, but those
        data feeds do not receive a visitor&apos;s browsing history from this site.
      </p>

      <h2>Questions</h2>
      <p>
        To ask about privacy or request a correction, use the contact routes on the{" "}
        <Link href="/about/">About page</Link>.
      </p>
    </main>
  );
}
