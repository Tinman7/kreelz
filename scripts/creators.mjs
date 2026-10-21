// Popular videos from individual creators (not only official channels), across every category.
// usage: YT_API_KEY=... node scripts/creators.mjs creators.json
// Each night a rotating set of searches (most viewed of the last 30 days) is run; the video's category comes from
// scripts/classify.mjs. Full re-uploads of broadcasts/MVs/episodes and non-Korean videos are not taken.
import fs from "node:fs"; import zlib from "node:zlib";
import { classify, channelPriors, koreanChannels, isKorean } from "./classify.mjs";
import { hasThumb } from "./thumbs.mjs";
const KEY = process.env.YT_API_KEY; if (!KEY) { console.error("YT_API_KEY missing"); process.exit(1); }
const outPath = process.argv[2] || "creators.json";
const SEARCHES = +(process.env.CREATOR_SEARCHES || 12);
const MIN_VIEWS = +(process.env.CREATOR_MIN_VIEWS || 100000);
const QUERIES = [
  "kpop dance cover", "케이팝 커버", "kpop reaction", "아이돌 직캠",
  "드라마 리뷰", "드라마 몰아보기", "kdrama reaction", "영화 리뷰 결말",
  "예능 레전드", "korean variety funny", "한국 브이로그", "korea vlog",
  "메이크업 추천템", "kbeauty", "스킨케어 루틴", "얼굴 마사지 방법", "korean skincare routine", "피부관리 꿀팁", "먹방", "korean food mukbang", "한국 길거리 음식", "편의점 신상",
];
const EXCLUDE = /full ?(ver|version|episode|ep|show|movie)|풀버전|풀영상|전편|다시보기|eng ?sub|1080p|4k full|\[?mv\]?\b|m\/v|music video|official (audio|video)|lyrics?|가사|\b1 ?hour|1시간|playlist|nightcore|8d|sped up|slowed|karaoke|노래방/i;
const API = "https://www.googleapis.com/youtube/v3/", DAY = 864e5;
let used = 0;
async function call(ep, params, cost) {
  for (let t = 0; t < 3; t++) {
    const r = await fetch(API + ep + "?" + new URLSearchParams({ ...params, key: KEY }));
    const d = await r.json().catch(() => ({}));
    if (!d.error) { used += cost; return d; }
    if (/quota/i.test(JSON.stringify(d.error))) throw new Error("quota");
    await new Promise(s => setTimeout(s, 2000 * (t + 1)));
  }
  return { items: [] };
}
const dur = s => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const start = Math.floor(Date.now() / DAY) * SEARCHES % QUERIES.length;
const today = Array.from({ length: Math.min(SEARCHES, QUERIES.length) }, (_, i) => QUERIES[(start + i) % QUERIES.length]);
const since = new Date(Date.now() - 30 * DAY).toISOString();
const found = new Set();
try {
  for (const q of today) {
    const d = await call("search", { part: "id", q, type: "video", order: "viewCount", publishedAfter: since, videoEmbeddable: "true", maxResults: 50 }, 100);
    for (const x of d.items || []) if (x.id?.videoId) found.add(x.id.videoId);
  }
} catch (e) { console.log("search stopped:", e.message); }
const h = fs.readFileSync("index.html", "utf8");
const onSite = new Set(); for (const n of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) onSite.add(s.slice(i, i + 11)); }
const ids = [...found].filter(id => !onSite.has(id));
const VMETA = "data/vmeta.json.gz";
const vmeta = fs.existsSync(VMETA) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(VMETA))) : {};
const fresh = [];
for (let i = 0; i < ids.length; i += 50) {
  const d = await call("videos", { part: "snippet,statistics,contentDetails,status,topicDetails", id: ids.slice(i, i + 50).join(","), maxResults: 50 }, 1);
  for (const v of d.items || []) {
    const s = v.snippet || {}, st = v.status || {}, secs = dur((v.contentDetails || {}).duration), views = +((v.statistics || {}).viewCount || 0);
    const meta = [s.title || "", s.channelId || "", s.channelTitle || "", s.categoryId || "", ((v.topicDetails || {}).topicCategories || []).map(u => u.split("/").pop()), (s.tags || []).slice(0, 12), secs];
    if (!(st.uploadStatus === "processed" && st.privacyStatus === "public" && st.embeddable !== false && (s.liveBroadcastContent || "none") === "none")) continue;
    if (views < MIN_VIEWS || secs <= 0 || secs > 40 * 60 || EXCLUDE.test(meta[0])) continue;
    vmeta[v.id] = meta;
    fresh.push({ id: v.id, meta, views, secs, days: Math.max(0, Math.floor((Date.now() - new Date(s.publishedAt)) / DAY)), short: secs <= 180 && (/#shorts?\b/i.test(meta[0] + " " + meta[5].join(" ")) || secs <= 60) });
  }
}
const known = Object.values(vmeta), prior = channelPriors(known), kch = koreanChannels(known, []);
const picked = fresh.filter(f => isKorean(f.meta, kch)).map(f => ({ ...f, cat: classify(f.meta, null, true, kch) }))   // judged on the video itself, no channel prior.filter(f => f.cat);
const good = new Set(), q = picked.map(k => k.id);
await Promise.all(Array.from({ length: 16 }, async () => { while (q.length) { const id = q.pop(); if (await hasThumb(id, "v")) good.add(id); } }));
const out = { videos: {}, shorts: {} }, byCat = {};
for (const k of picked) { if (!good.has(k.id)) continue; byCat[k.cat] = (byCat[k.cat] || 0) + 1;
  if (k.short) out.shorts[k.id] = [k.cat, k.views, 0, k.days]; else out.videos[k.id] = [k.cat, k.views, k.days, 0]; }
fs.writeFileSync(VMETA, zlib.gzipSync(JSON.stringify(vmeta)));
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(JSON.stringify({ searches: today, found: found.size, new: ids.length, kept: Object.keys(out.videos).length + Object.keys(out.shorts).length, by_category: byCat, quota_used: used }));
