import { logoFor } from "@/lib/data";

// Real club crest from API-Football media CDN; monogram fallback if unmapped.
const SIZES = { sm: 20, md: 26, xl: 56 } as const;

function blueHue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return 205 + (h % 24);
}

export function Crest({ club, slug, size }: { club: string; slug: string; size?: "sm" | "xl" }) {
  const px = SIZES[size ?? "md"];
  const logo = logoFor(slug);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} width={px} height={px} alt="" aria-hidden loading="lazy"
      style={{ objectFit: "contain", flex: "none", display: "inline-block" }} />;
  }
  const words = club.split(/\s+/).filter(Boolean);
  const initials = words.length === 1 ? words[0].slice(0, 2) : (words[0][0] + words[words.length - 1][0]).slice(0, 2);
  return (
    <span className={`crest${size ? ` ${size}` : ""}`} aria-hidden
      style={{ background: `hsl(${blueHue(slug)} 38% 34%)`, width: px, height: px, fontSize: px * 0.38 }}>
      {initials}
    </span>
  );
}
