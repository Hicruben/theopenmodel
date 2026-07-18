import { latestNews, timeAgo } from "@/lib/news";

// Headline aggregator — thumbnails + titles + outbound links only (we host no article text).
export function NewsBox({ n = 8, filter, title = "Football news" }: { n?: number; filter?: string[]; title?: string }) {
  const items = latestNews(n, filter);
  if (!items.length) return null;
  return (
    <div className="box">
      <h3>{title}</h3>
      <div className="bd" style={{ display: "grid", gap: 12, padding: "12px 14px" }}>
        {items.map((i, idx) => (
          <a key={i.link} href={i.link} target="_blank" rel="noopener nofollow" className="newsitem"
            style={{ textDecoration: "none", display: "grid", gridTemplateColumns: i.img ? "64px 1fr" : "1fr", gap: 10, alignItems: "start" }}>
            {i.img && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={i.img} alt="" width={64} height={48} loading={idx < 2 ? "eager" : "lazy"}
                style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 8, border: "1px solid var(--rule)", background: "var(--panel-2)" }} />
            )}
            <span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35, display: "block" }}>
                {i.title}
              </span>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                {i.src} · {timeAgo(i.date)} ↗
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
