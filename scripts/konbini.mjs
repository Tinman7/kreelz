// K-Food tab (both editions): popular shorts and videos of Korean convenience-store tours and finds (drink combos,
// cup-ramyeon machines, new snacks) and Han River ramyeon / picnics, from Korean and foreign creators.
// usage: YT_API_KEY=... node scripts/konbini.mjs konbini.out.json      (config: scripts/konbini.json)
import fs from "node:fs"; import zlib from "node:zlib";
import { hasThumb } from "./thumbs.mjs";
const KEY = process.env.YT_API_KEY; if (!KEY) { console.error("YT_API_KEY missing"); process.exit(1); }
const CHECK = process.argv.includes("--check");   // show what would be taken; writes nothing, 2 searches
const outPath = process.argv.slice(2).find(a => !a.startsWith("--")) || "konbini.out.json";
const CFG = "scripts/konbini.json", VMETA = "data/vmeta.json.gz";
const API = "https://www.googleapis.com/youtube/v3/", DAY = 864e5;
let used = 0;
async function call(ep, params) {
  for (let t = 0; t < 3; t++) {
    const r = await fetch(API + ep + "?" + new URLSearchParams({ ...params, key: KEY }));
    const d = await r.json().catch(() => ({}));
    if (!d.error) { used += ep === "search" ? 100 : 1; return d; }
    if (/quota/i.test(JSON.stringify(d.error))) throw new Error("quota");
    await new Promise(s => setTimeout(s, 2000 * (t + 1)));
  }
  return { items: [] };
}
const dur = s => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const cfg = JSON.parse(fs.readFileSync(CFG, "utf8")), L = cfg.queries || [];
const n = Math.min(CHECK ? 2 : cfg.done ? (cfg.per_night || 3) : (cfg.first_run || 6), L.length);
const start = cfg.done ? Math.floor(Date.now() / DAY) * n % L.length : 0;
const qs = Array.from({ length: n }, (_, i) => L[(start + i) % L.length]);
const since = new Date(Date.now() - (cfg.done ? 60 : 365) * DAY).toISOString();
const found = new Set();
try { for (const q of qs) {
  let d = await call("search", { part: "id", q, type: "video", order: "viewCount", publishedAfter: since, videoEmbeddable: "true", maxResults: 50 });
  if (!(d.items || []).length && d.pageInfo?.totalResults) d = await call("search", { part: "id", q, type: "video", order: "relevance", publishedAfter: since, videoEmbeddable: "true", maxResults: 50 });
  for (const x of d.items || []) if (x.id?.videoId) found.add(x.id.videoId);
} } catch (e) { console.log("search stopped:", e.message); }
const h = fs.readFileSync("index.html", "utf8");
const onSite = new Set(); for (const k of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${k} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) onSite.add(s.slice(i, i + 11)); }
const ids = [...found].filter(id => !onSite.has(id));
const vmeta = fs.existsSync(VMETA) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(VMETA))) : {};
// on topic: a convenience store or the Han River, in Korea; no full re-uploads, music videos or news
const TOPIC = /편의점|convenience ?store|\bGS25\b|\bCU\b|세븐일레븐|7-?eleven|이마트24|emart24|꿀조합|한강 ?라면|한강 ?피크닉|한강.{0,12}(라면|피크닉|치킨|먹|편의점|돗자리)|han ?river.{0,20}(ramyeon|ramen|picnic|food|eat|convenience)|hangang.{0,20}(ramyeon|ramen|picnic)|라면 ?기계|ramyeon ?machine|ramen ?machine/i;
const KOREA = /[가-힣]|korea|seoul|busan|한국|서울/i;
const NOT = /full ?(ver|version|episode)|풀버전|\bmv\b|m\/v|music video|뉴스|news|사건|사고|lyrics?|가사|playlist/i;
const out = { videos: {}, shorts: {} }, cand = [];
for (let i = 0; i < ids.length; i += 50) {
  const d = await call("videos", { part: "snippet,statistics,contentDetails,status,topicDetails", id: ids.slice(i, i + 50).join(","), maxResults: 50 });
  for (const v of d.items || []) {
    const s = v.snippet || {}, st = v.status || {}, secs = dur((v.contentDetails || {}).duration), views = +((v.statistics || {}).viewCount || 0);
    const meta = [s.title || "", s.channelId || "", s.channelTitle || "", s.categoryId || "", ((v.topicDetails || {}).topicCategories || []).map(u => u.split("/").pop()), (s.tags || []).slice(0, 12), secs];
    const text = meta[0] + " " + meta[5].join(" ");
    if (!(st.uploadStatus === "processed" && st.privacyStatus === "public" && st.embeddable !== false && (s.liveBroadcastContent || "none") === "none")) continue;
    if (views < (cfg.min_views || 50000) || secs <= 0 || secs > 30 * 60 || !TOPIC.test(text) || !KOREA.test(text + " " + (s.description || "").slice(0, 300)) || NOT.test(meta[0])) continue;
    vmeta[v.id] = meta;
    cand.push({ id: v.id, views, days: Math.max(0, Math.floor((Date.now() - new Date(s.publishedAt)) / DAY)), short: secs <= 180 && (secs <= 60 || /#shorts?\b/i.test(text)), t: meta[0] });
  }
}
const good = new Set(), q = cand.map(c => c.id);
await Promise.all(Array.from({ length: 16 }, async () => { while (q.length) { const id = q.pop(); if (await hasThumb(id, "v")) good.add(id); } }));
for (const c of cand) { if (!good.has(c.id)) continue;
  if (c.short) out.shorts[c.id] = ["k", c.views, 0, c.days]; else out.videos[c.id] = ["k", c.views, c.days, 0]; }
if (!CHECK) {
  fs.writeFileSync(VMETA, zlib.gzipSync(JSON.stringify(vmeta)));
  fs.writeFileSync(outPath, JSON.stringify(out));
  cfg.done = true; fs.writeFileSync(CFG, JSON.stringify(cfg, null, 1) + "\n");
}
console.log(cand.filter(c => good.has(c.id)).slice(0, CHECK ? 25 : 12).map(c => `  ${c.short ? "short" : "video"} ${c.views} ${c.t.slice(0, 70)}`).join("\n"));
console.log(JSON.stringify({ searches: qs, found: found.size, new: ids.length, videos: Object.keys(out.videos).length, shorts: Object.keys(out.shorts).length, quota_used: used }));
