// IndexNow (per David 2026-11-06: "빙도 빨리"): tells Bing — and Naver, Yandex, Seznam, which share IndexNow — about the
// site's pages right after each publish, so they are crawled within hours instead of whenever. The key is public by
// design (the file /61400f202772af5f9aa2b6e739e2dc72.txt proves the site is ours). Sends every URL in sitemap.xml (well under the 10,000 limit).
// usage: node scripts/indexnow.mjs [sitemap.xml]
import fs from "node:fs";
const KEY = "61400f202772af5f9aa2b6e739e2dc72", HOST = "kreelz.com";
const urls = [...fs.readFileSync(process.argv[2] || "sitemap.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).slice(0, 10000);
if (!urls.length) { console.log("indexnow: no URLs"); process.exit(0); }
const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }) });
console.log("indexnow:", r.status, (await r.text()).slice(0, 200), "—", urls.length, "URLs");
