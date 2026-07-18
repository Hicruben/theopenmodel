import { TodayPortal } from "../components/TodayPortal";

export const metadata = {
  title: "Today in football: news, fixtures and predictions",
  description: "A daily football portal for major stories, upcoming fixtures, model probabilities, league coverage and players to watch.",
  alternates: { canonical: "/" },
};

export default function Today() {
  return (
    <main className="portal-page">
      <TodayPortal />
    </main>
  );
}
