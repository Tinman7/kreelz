// Drama / show videos of the focus actors (scripts/actors.mjs), romance first, most viewed first.
// usage: YT_API_KEY=... node scripts/actor_videos.mjs actors.json
//        ACTOR_MODE=fancam ... node scripts/actor_videos.mjs actor_fancams.json   (fancams: fan meetings, events, airport, concerts)
// Not taken: full re-uploads of MVs/broadcasts/episodes, lyric or audio-only uploads, long compilations,
// anything the uploader doesn't allow to embed, and videos without a thumbnail.
import fs from "node:fs"; import zlib from "node:zlib";
import { ACTORS, FANCAM } from "./actors.mjs";
import { classify, channelPriors, koreanChannels } from "./classify.mjs";
import { hasThumb } from "./thumbs.mjs";
const KEY = process.env.YT_API_KEY; if (!KEY) { console.error("YT_API_KEY missing"); process.exit(1); }
const outPath = process.argv[2] || "actors.json";
const FAN = process.env.ACTOR_MODE === "fancam";
const SEARCHES = +(process.env.ACTOR_SEARCHES || 10);        // 100 quota units each
const MIN_VIEWS = +(process.env.ACTOR_MIN_VIEWS || (FAN ? 20000 : 50000));
const KINDS = FAN ? [a => `${a[1]} 직캠`, a => `${a[0]} fancam`, a => `${a[1]} 팬미팅`, a => `${a[0]} fan meeting`]
                  : [a => `${a[1]} 드라마`, a => `${a[0]} kdrama romance`];
const EXCLUDE = /full ?(ver|version|episode|ep|show|movie)|풀버전|풀영상|전편|다시보기|eng ?sub|1080p|\[?mv\]?\b|m\/v|music video|lyrics?|가사|\b1 ?hour|1시간|playlist|karaoke|노래방/i;
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
// every (query type x artist) pair, rotated by day so all of them get their turn
const jobs = []; KINDS.forEach(k => ACTORS.forEach((a, ai) => jobs.push({ q: k(a), artist: ai })));
const start = (Math.floor(Date.now() / DAY) * SEARCHES + (FAN ? 7 : 0)) % jobs.length;
const today = Array.from({ length: Math.min(SEARCHES, jobs.length) }, (_, i) => jobs[(start + i) % jobs.length]);
const found = {};   // id -> artist index
try {
  for (const j of today) {
    const d = await call("search", { part: "id", q: j.q, type: "video", order: "viewCount", videoEmbeddable: "true", maxResults: 50 }, 100);
    for (const x of d.items || []) if (x.id?.videoId && !(x.id.videoId in found)) found[x.id.videoId] = j.artist;
  }
} catch (e) { console.log("search stopped:", e.message); }
const h = fs.readFileSync("index.html", "utf8");
const onSite = new Set(); for (const n of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) onSite.add(s.slice(i, i + 11)); }
const ids = Object.keys(found).filter(id => !onSite.has(id));
const VMETA = "data/vmeta.json.gz";
const vmeta = fs.existsSync(VMETA) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(VMETA))) : {};
const keep = [];
for (let i = 0; i < ids.length; i += 50) {
  const d = await call("videos", { part: "snippet,statistics,contentDetails,status,topicDetails", id: ids.slice(i, i + 50).join(","), maxResults: 50 }, 1);
  for (const v of d.items || []) {
    const s = v.snippet || {}, st = v.status || {}, secs = dur((v.contentDetails || {}).duration), views = +((v.statistics || {}).viewCount || 0);
    const meta = [s.title || "", s.channelId || "", s.channelTitle || "", s.categoryId || "", ((v.topicDetails || {}).topicCategories || []).map(u => u.split("/").pop()), (s.tags || []).slice(0, 12), secs];
    const text = meta[0] + " " + meta[5].join(" ");
    const a = ACTORS[found[v.id]];
    const ok = st.uploadStatus === "processed" && st.privacyStatus === "public" && st.embeddable !== false && (s.liveBroadcastContent || "none") === "none"
      && views >= MIN_VIEWS && secs > 0 && secs <= (FAN ? 20 : 40) * 60 && a[2].test(text) && !EXCLUDE.test(meta[0]) && (!FAN || FANCAM.test(text));
    if (!ok) continue;
    vmeta[v.id] = meta;
    keep.push({ id: v.id, meta, views, days: Math.max(0, Math.floor((Date.now() - new Date(s.publishedAt)) / DAY)), short: secs <= 180 && (/#shorts?\b/i.test(text) || secs <= 60) });
  }
}
const good = new Set(), q = keep.map(k => k.id);
await Promise.all(Array.from({ length: 16 }, async () => { while (q.length) { const id = q.pop(); if (await hasThumb(id, "v")) good.add(id); } }));
const known = Object.values(vmeta), prior = channelPriors(known), kch = koreanChannels(known, []);
const out = { videos: {}, shorts: {} };
for (const k of keep) {
  if (!good.has(k.id)) continue;
  let cat = classify(k.meta, prior, true, kch);
  if (FAN && (!cat || !"dfe".includes(cat))) cat = "e";  // fancams of the actors: Shows/Entertainment
  if (!cat || !"dfe".includes(cat)) continue;            // Screen and Shows only
  if (k.short) out.shorts[k.id] = [cat, k.views, 0, k.days]; else out.videos[k.id] = [cat, k.views, k.days, 0];
}
fs.writeFileSync(VMETA, zlib.gzipSync(JSON.stringify(vmeta)));
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(JSON.stringify({ searches: today.length, found: Object.keys(found).length, new: ids.length, kept: Object.keys(out.videos).length + Object.keys(out.shorts).length, videos: Object.keys(out.videos).length, shorts: Object.keys(out.shorts).length, quota_used: used }));
