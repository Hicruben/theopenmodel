#!/usr/bin/env node
// Submit freshly-rebuilt URLs to IndexNow (Bing, Yandex, Seznam, Naver — Google does
// not participate). The whole site re-exports daily and the forecasts genuinely change,
// so telling those engines directly beats waiting to be recrawled — which matters most
// while the domain has little authority of its own.
//
// IndexNow keys are public by design: the key file is served openly at keyLocation so
// the engine can verify we own the host. Keeping it in source is fine.
//
//   node scripts/indexnow-ping.mjs          (after a build — reads out/sitemap.xml)
//   DRY_RUN=1 node scripts/indexnow-ping.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HOST = "theopenmodel.com";
const KEY = "cd61b3e7aec6bbd82b82a2ea881e66f4";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP = join(process.cwd(), "out", "sitemap.xml");
const DRY = process.env.DRY_RUN === "1";

let xml;
try { xml = readFileSync(SITEMAP, "utf8"); }
catch { console.error(`✗ no built sitemap at ${SITEMAP} — run the build first.`); process.exit(1); }

const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) { console.error("✗ no <loc> URLs found in the sitemap."); process.exit(1); }

if (DRY) {
  console.log(`◦ dry run — would submit ${urls.length} URLs to IndexNow as ${HOST}`);
  console.log(`  key file: ${KEY_LOCATION}`);
  for (const u of urls.slice(0, 5)) console.log(`  ${u}`);
  if (urls.length > 5) console.log(`  … and ${urls.length - 5} more`);
  process.exit(0);
}

const CHUNK = 10000;   // IndexNow's documented per-request ceiling
let ok = 0;
for (let i = 0; i < urls.length; i += CHUNK) {
  const urlList = urls.slice(i, i + CHUNK);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  });
  console.log(`IndexNow batch ${Math.floor(i / CHUNK) + 1}: ${urlList.length} URLs → HTTP ${res.status}`);
  // 200 = accepted, 202 = accepted pending key validation.
  if (res.status === 200 || res.status === 202) ok += urlList.length;
  else console.error("  body:", (await res.text()).slice(0, 200));
}
console.log(`✓ submitted ${ok}/${urls.length} URLs to IndexNow. Key: ${KEY_LOCATION}`);
