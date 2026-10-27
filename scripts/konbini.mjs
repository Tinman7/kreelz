// K-Food tab (both editions): popular shorts and videos of Korean convenience-store tours and finds (drink combos,
// cup-ramyeon machines, new snacks) and Han River ramyeon / picnics, from Korean and foreign creators.
// usage: YT_API_KEY=... node scripts/konbini.mjs konbini.out.json      (config: scripts/konbini.json)
import fs from "node:fs"; import zlib from "node:zlib";
import { hasThumb } from "./thumbs.mjs";
import { ARTISTS, EXTRA_MALE, JP_ARTISTS, rank, rankIn } from "./hybe.mjs";
const KEY = process.env.YT_API_KEY; if (!KEY) { console.error("YT_API_KEY missing"); process.exit(1); }
const CHECK = process.argv.includes("--check");   // show what would be taken; writes nothing, 2 searches
const HOT_ONLY = process.argv.includes("--hot");   // only the "hot" groups (a viral moment, run at once when asked)
// --live <file>: write the finds to live.js (shown by the page at once, both editions) instead of the site data — no
// change to index.html / data / config, so it never collides with a nightly refresh that is already running
const LIVE_AT = process.argv.indexOf("--live"), LIVE_F = LIVE_AT > 0 ? process.argv[LIVE_AT + 1] : "";
const outPath = process.argv.slice(2).find((a, i, A) => !a.startsWith("--") && A[i - 1] !== "--live") || "konbini.out.json";
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
const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
const groups = cfg.groups || [{ ...cfg, name: "konbini", topic: "konbini" }];
const found = new Map(), asked = [];   // id -> group
// these searches share the nightly YouTube quota: at most KF_SEARCHES a night, the groups taking turns
let budget = +(process.env.KF_SEARCHES || 5);
// "hot" groups (a viral moment David points at, e.g. a new MV): every night until their end date, before the rotation,
// all their queries, newest-first window from their start date; they don't count against KF_SEARCHES
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // KST
try { for (const g of groups) { if (g.topic !== "hot" || (g.until && today > g.until)) continue;
  const L = (g.queries || []).slice(0, CHECK ? 2 : g.per_night || 6); g.ran = true;
  const since = new Date(g.since ? g.since + "T00:00:00+09:00" : Date.now() - 7 * DAY).toISOString();
  for (const q of L) { asked.push(q);
    let d = await call("search", { part: "id", q, type: "video", order: "viewCount", publishedAfter: since, videoEmbeddable: "true", maxResults: 50 });
    if (!(d.items || []).length && d.pageInfo?.totalResults) d = await call("search", { part: "id", q, type: "video", order: "relevance", publishedAfter: since, videoEmbeddable: "true", maxResults: 50 });
    for (const x of d.items || []) if (x.id?.videoId && !found.has(x.id.videoId)) found.set(x.id.videoId, g); } } }
catch (e) { console.log("hot search stopped:", e.message); }
if (HOT_ONLY) budget = 0;
const rot = groups.filter(g => g.topic !== "hot");
const off = Math.floor(Date.now() / DAY) % Math.max(1, rot.length);
try { for (let gi = 0; gi < rot.length && budget > 0; gi++) { const g = rot[(off + gi) % rot.length];
  const L = g.queries || []; if (!L.length) continue;
  const n = Math.min(CHECK ? 2 : g.done ? (g.per_night || 3) : (g.first_run || 6), L.length, budget);
  budget -= n; g.ran = true;
  const start = g.done ? Math.floor(Date.now() / DAY) * n % L.length : 0;
  const since = new Date(Date.now() - (g.done ? 60 : 365) * DAY).toISOString();
  for (let i = 0; i < n; i++) { const q = L[(start + i) % L.length]; asked.push(q);
    let d = await call("search", { part: "id", q, type: "video", order: "viewCount", publishedAfter: since, videoEmbeddable: "true", maxResults: 50 });
    if (!(d.items || []).length && d.pageInfo?.totalResults) d = await call("search", { part: "id", q, type: "video", order: "relevance", publishedAfter: since, videoEmbeddable: "true", maxResults: 50 });
    for (const x of d.items || []) if (x.id?.videoId && !found.has(x.id.videoId)) found.set(x.id.videoId, g); }
} } catch (e) { console.log("search stopped:", e.message); }
const qs = asked;
const h = fs.readFileSync("index.html", "utf8");
const onSite = new Set(); for (const k of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${k} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) onSite.add(s.slice(i, i + 11)); }
const ids = [...found.keys()].filter(id => LIVE_F || !onSite.has(id));   // live: also the ones on the site (for the pins)
const vmeta = fs.existsSync(VMETA) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(VMETA))) : {};
// on topic: a convenience store or the Han River, in Korea; no full re-uploads, music videos or news
const TOPIC = /편의점|convenience ?store|\bGS25\b|\bCU\b|세븐일레븐|7-?eleven|이마트24|emart24|꿀조합|한강 ?라면|한강 ?피크닉|한강.{0,12}(라면|피크닉|치킨|먹|편의점|돗자리)|han ?river.{0,20}(ramyeon|ramen|picnic|food|eat|convenience)|hangang.{0,20}(ramyeon|ramen|picnic)|라면 ?기계|ramyeon ?machine|ramen ?machine/i;
const KOREA = /[가-힣]|korea|seoul|busan|한국|서울/i;
// pilgrimage: fans at an idol's (or a drama's) filming location, or at a restaurant / cafe the idols went to
const PILGRIM = /성지순례|pilgrimage|filming (location|spot)s?|촬영지|촬영 ?장소|단골|다녀간|갔던|방문한|visited|went to|favou?rite (restaurant|cafe|spot|place)|(restaurant|cafe|spot|place)s? (of|by|where)|where .{0,25}(ate|eat|went|filmed)|성지|뮤비 ?촬영/i;
const IDOL = t => /kpop|k-pop|idol|아이돌|케이팝|k-?drama|드라마/i.test(t) || [...ARTISTS, ...EXTRA_MALE].some(a => a[2].test(t));
// traditional Seoul and Busan: the place named, and a visit / tour / food / cafe / hanbok angle (not a drama scene or a stage)
const HERITAGE = /경복궁|창덕궁|덕수궁|창경궁|고궁|궁궐|palace|gyeongbok|changdeok|deoksu|북촌|bukchon|서촌|seochon|부암동|buam|익선동|ikseon|인사동|insadong|종로|jongno|포차|pocha|한옥|hanok|한복|hanbok/i;
const BUSAN = /부산|busan|해운대|haeundae|광안리|gwangalli|감천|gamcheon|흰여울|huinnyeoul|자갈치|jagalchi|남포|nampo|해동용궁사|haedong|송도|songdo|전포|jeonpo|서면|seomyeon|영도|yeongdo|기장|gijang|깡통시장|kkangtong|국제시장|gukje|블루라인|blueline|스카이캡슐|sky ?capsule|밀락|millac/i;
const VISIT = /체험|투어|tour|vlog|브이로그|여행|travel|trip|맛집|카페|cafe|café|food|먹|eat|대여|rental|rent|헤어|hair|산책|walk|가이드|guide|추천|things to do|코스|시장|market|야경|night|드론쇼|drone|구경|방문|visit|explor|첫 ?방문|first time/i;
const NOT_PLACE = /\bmv\b|m\/v|직캠|fancam|무대|stage|드라마 ?(리뷰|결말)|ep\.? ?\d|회차|예고|teaser|trailer/i;
const onTopic = (g, text) => g.topic === "hot" ? (g.require || []).every(r => new RegExp(r, "i").test(text))
  : g.topic === "pilgrimage" ? PILGRIM.test(text) && IDOL(text)
  : g.topic === "heritage" ? HERITAGE.test(text) && VISIT.test(text) && !NOT_PLACE.test(text)
  : g.topic === "busan" ? BUSAN.test(text) && VISIT.test(text) && !NOT_PLACE.test(text)
  : TOPIC.test(text);
const NOT = /full ?(ver|version|episode)|풀버전|\bmv\b|m\/v|music video|뉴스|news|사건|사고|lyrics?|가사|playlist|대통령|president|정치|선거|study ?abroad|study ?in ?korea|유학|\/ ?(KNN|KBS|MBC|SBS|YTN|JTBC|MBN|TV조선|채널A|연합뉴스)|승무원/i;   // + politics, study-abroad, local-news clips (2026-10-27 check)
const out = { videos: {}, shorts: {} }, cand = [];
for (let i = 0; i < ids.length; i += 50) {
  const d = await call("videos", { part: "snippet,statistics,contentDetails,status,topicDetails", id: ids.slice(i, i + 50).join(","), maxResults: 50 });
  for (const v of d.items || []) {
    const s = v.snippet || {}, st = v.status || {}, secs = dur((v.contentDetails || {}).duration), views = +((v.statistics || {}).viewCount || 0);
    const meta = [s.title || "", s.channelId || "", s.channelTitle || "", s.categoryId || "", ((v.topicDetails || {}).topicCategories || []).map(u => u.split("/").pop()), (s.tags || []).slice(0, 12), secs];
    const text = meta[0] + " " + meta[5].join(" ");
    if (!(st.uploadStatus === "processed" && st.privacyStatus === "public" && st.embeddable !== false && (s.liveBroadcastContent || "none") === "none")) continue;
    const g = found.get(v.id);
    const hot = g.topic === "hot";
    if (views < (g.min_views || 50000) || secs <= 0 || secs > 30 * 60 || !onTopic(g, text)) continue;
    if (hot ? new RegExp(g.not || "full ?(ver|version)|풀버전|lyrics?|가사|playlist|1 ?hour|loop", "i").test(meta[0]) : (!KOREA.test(text + " " + (s.description || "").slice(0, 300)) || NOT.test(meta[0]))) continue;
    vmeta[v.id] = meta;
    cand.push({ g: g.name, cat: g.cat, pin: !!g.pin, until: g.until, on: onSite.has(v.id), meta, up: (s.publishedAt || "").slice(0, 10), id: v.id, views, days: Math.max(0, Math.floor((Date.now() - new Date(s.publishedAt)) / DAY)), short: secs <= 180 && (secs <= 60 || /#shorts?\b/i.test(text)), t: meta[0] });
  }
}
const good = new Set(), q = cand.map(c => c.id);
await Promise.all(Array.from({ length: 16 }, async () => { while (q.length) { const id = q.pop(); if (await hasThumb(id, "v")) good.add(id); } }));
for (const c of cand) { if (!good.has(c.id) || c.on) continue;
  const k = c.cat || "k";
  if (c.short) out.shorts[c.id] = [k, c.views, 0, c.days]; else out.videos[c.id] = [k, c.views, c.days, 0]; }
if (LIVE_F && !CHECK) {   // [id, cat, views, upload day, rank (global), rank (/jp), title, channel]
  const old = (() => { try { return JSON.parse(fs.readFileSync(LIVE_F, "utf8").replace(/^window\.LIVE=/, "").replace(/;\s*$/, "")) } catch (e) { return { v: [], s: [] } } })();
  const keep = new Map([...(old.v || []), ...(old.s || [])].map(x => [x[0], x]));
  const pin = new Set((old.pin && old.pin.ids) || []); let until = (old.pin && old.pin.until) || "";
  for (const c of cand) { if (!good.has(c.id)) continue;
    if (c.pin) { pin.add(c.id); if (c.until > until) until = c.until; }
    if (c.on) continue;
    keep.set(c.id, [c.id, c.cat || "k", c.views, c.up, rank(c.meta) || 0, rankIn(JP_ARTISTS, c.meta) || 0, c.meta[0].slice(0, 150), c.meta[2], c.short ? 1 : 0]); }
  const all = [...keep.values()].filter(x => Date.now() - Date.parse(x[3]) < 14 * DAY);
  const L = { built: new Date().toISOString(), v: all.filter(x => !x[8]), s: all.filter(x => x[8]), pin: { until, ids: [...pin] }, ja: old.ja || {}, en: old.en || {} };   // titles translated by hand stay
  fs.writeFileSync(LIVE_F, "window.LIVE=" + JSON.stringify(L) + ";\n");
} else if (!CHECK) {
  fs.writeFileSync(VMETA, zlib.gzipSync(JSON.stringify(vmeta)));
  fs.writeFileSync(outPath, JSON.stringify(out));
  for (const g of groups) if (g.ran) { g.done = true; delete g.ran; } fs.writeFileSync(CFG, JSON.stringify(cfg.groups ? cfg : groups[0], null, 1) + "\n");
}
console.log(cand.filter(c => good.has(c.id)).sort((x, y) => x.g < y.g ? -1 : 1).slice(0, CHECK ? 40 : 12).map(c => `  [${c.g}] ${c.short ? "short" : "video"} ${c.views} ${c.t.slice(0, 70)}`).join("\n"));
console.log(JSON.stringify({ searches: qs, found: found.size, new: ids.length, videos: Object.keys(out.videos).length, shorts: Object.keys(out.shorts).length, quota_used: used }));
