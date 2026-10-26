// Fan-made videos (fancams, dance covers, fan edits/FMVs) of the priority artists, most viewed first.
// usage: YT_API_KEY=... node scripts/fans.mjs fans.json
// Not taken: full re-uploads of MVs/broadcasts/episodes, lyric or audio-only uploads, long compilations,
// anything the uploader doesn't allow to embed, and videos without a thumbnail.
import fs from "node:fs"; import zlib from "node:zlib";
import { ARTISTS as LISTED, MALE, EXTRA_MALE, FANCAM_M } from "./hybe.mjs";
const ARTISTS = [...LISTED, ...EXTRA_MALE];
import { hasThumb } from "./thumbs.mjs";
const KEY = process.env.YT_API_KEY; if (!KEY) { console.error("YT_API_KEY missing"); process.exit(1); }
const outPath = process.argv[2] || "fans.json";
const SEARCHES = +(process.env.FAN_SEARCHES || 33);          // 100 quota units each
const MIN_VIEWS = +(process.env.FAN_MIN_VIEWS || 100000);
const KO = { "BTS": "방탄소년단", "CORTIS": "코르티스", "LE SSERAFIM": "르세라핌", "ILLIT": "아일릿", "Stray Kids": "스트레이키즈", "TWICE": "트와이스", "TUIDE": "튜이드",
  "TXT": "투모로우바이투게더", "TWS": "투어스", "ENHYPEN": "엔하이픈", "ATEEZ": "에이티즈", "KATSEYE": "캣츠아이",
  "SEVENTEEN": "세븐틴", "NCT DREAM": "엔시티 드림", "NCT 127": "엔시티 127", "RIIZE": "라이즈", "BOYNEXTDOOR": "보이넥스트도어",
  "ZEROBASEONE": "제로베이스원", "TREASURE": "트레저", "EXO": "엑소", "BIGBANG": "빅뱅" };
// boy groups (priority list + other popular boy groups): performance and concert fancams
const BOY_KINDS = [n => `${n} fancam`, n => `${KO[n] || n} 직캠`, n => `${n} concert fancam`, n => `${KO[n] || n} 콘서트 직캠`];
// every priority artist: fancams (girl groups) and fan-made covers/edits
const ALL_KINDS = [n => `${n} dance cover`, n => `${n} fmv`];
const GIRL_KINDS = [n => `${n} fancam`, n => `${KO[n] || n} 직캠`];
const EXCLUDE = /full ?(ver|version|episode|ep|show|concert|performance)|풀버전|풀영상|full\b|eng ?sub|\bep\.? ?\d|episode|\[?mv\]?\b|m\/v|music video|official (audio|video)|lyrics?|가사|audio\b|\b1 ?hour|1시간|playlist|nightcore|8d|sped up|slowed|karaoke|노래방|instrumental|\bremix\b/i;
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
const jobs = [], isBoy = a => MALE.has(a[0]) || EXTRA_MALE.includes(a);
BOY_KINDS.forEach(k => ARTISTS.forEach((a, ai) => { if (isBoy(a)) jobs.push({ q: k(a[0]), artist: ai, cam: true }); }));
GIRL_KINDS.forEach(k => ARTISTS.forEach((a, ai) => { if (!isBoy(a)) jobs.push({ q: k(a[0]), artist: ai }); }));
ALL_KINDS.forEach(k => LISTED.forEach((a, ai) => jobs.push({ q: k(a[0]), artist: ai })));
// Latest performances first for TWICE (per David 2026-10-26): one of tonight's searches is always a TWICE search limited to
// the last year (THIS IS FOR world tour Jul 2025 - Jul 2026, its Seoul finale, festivals and stages since), one query per night
const TW = ARTISTS.findIndex(a => a[0] === "TWICE"), TW_RECENT = ["TWICE THIS IS FOR fancam", "트와이스 직캠", "TWICE world tour fancam", "TWICE stage 4K"];
const day = Math.floor(Date.now() / DAY), recent = TW >= 0 && SEARCHES > 1 ? [{ q: TW_RECENT[day % TW_RECENT.length], artist: TW, since: 365 }] : [];
const start = day * (SEARCHES - recent.length) % jobs.length;
const today = [...recent, ...Array.from({ length: Math.min(SEARCHES - recent.length, jobs.length) }, (_, i) => jobs[(start + i) % jobs.length])];
const found = {}, camJob = {};   // id -> artist index; id found by a boy-group fancam search
try {
  for (const j of today) {
    const d = await call("search", { part: "id", q: j.q, type: "video", order: "viewCount", videoEmbeddable: "true", maxResults: 50,
      ...(j.since ? { publishedAfter: new Date(Date.now() - j.since * DAY).toISOString() } : {}) }, 100);
    for (const x of d.items || []) if (x.id?.videoId && !(x.id.videoId in found)) { found[x.id.videoId] = j.artist; if (j.cam) camJob[x.id.videoId] = 1; }
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
    const a = ARTISTS[found[v.id]];
    const ok = st.uploadStatus === "processed" && st.privacyStatus === "public" && st.embeddable !== false && (s.liveBroadcastContent || "none") === "none"
      && views >= MIN_VIEWS && secs > 0 && secs <= 15 * 60 && a[2].test(text) && !EXCLUDE.test(meta[0]) && (!camJob[v.id] || FANCAM_M.test(text))
      && (found[v.id] < LISTED.length || FANCAM_M.test(text));       // other boy groups: performance fancams only
    if (!ok) continue;
    vmeta[v.id] = meta;
    keep.push({ id: v.id, views, days: Math.max(0, Math.floor((Date.now() - new Date(s.publishedAt)) / DAY)), short: secs <= 180 && (/#shorts?\b/i.test(text) || secs <= 60) });
  }
}
const good = new Set(), q = keep.map(k => k.id);
await Promise.all(Array.from({ length: 16 }, async () => { while (q.length) { const id = q.pop(); if (await hasThumb(id, "v")) good.add(id); } }));
const out = { videos: {}, shorts: {} };
for (const k of keep) { if (!good.has(k.id)) continue; if (k.short) out.shorts[k.id] = ["m", k.views, 0, k.days]; else out.videos[k.id] = ["m", k.views, k.days, 0]; }
fs.writeFileSync(VMETA, zlib.gzipSync(JSON.stringify(vmeta)));
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(JSON.stringify({ searches: today.length, found: Object.keys(found).length, new: ids.length, kept: Object.keys(out.videos).length + Object.keys(out.shorts).length, videos: Object.keys(out.videos).length, shorts: Object.keys(out.shorts).length, quota_used: used }));
