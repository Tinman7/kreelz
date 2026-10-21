// Pull a channel's back catalogue (official channels only) into the site's daily format.
// usage: YT_API_KEY=... node scripts/backfill.mjs out.json "<channelId>:all" "<channelId>:300" ...
import fs from "node:fs"; import zlib from "node:zlib";
import { classify, channelPriors, koreanChannels } from "./classify.mjs";
import { hasThumb } from "./thumbs.mjs";
const KEY = process.env.YT_API_KEY; if (!KEY) { console.error("YT_API_KEY missing"); process.exit(1); }
const [outPath, ...specs] = process.argv.slice(2);
const API = "https://www.googleapis.com/youtube/v3/", DAY = 864e5;
let used = 0;
async function call(ep, params) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(API + ep + "?" + new URLSearchParams({ ...params, key: KEY }));
    const d = await r.json().catch(() => ({}));
    if (!d.error) { used++; return d; }
    if (/quota/i.test(JSON.stringify(d.error))) throw new Error("quota");
    if (r.status === 404) return { items: [] };
    await new Promise(s => setTimeout(s, 2000 * (t + 1)));
  }
  return { items: [] };
}
async function playlistAll(pid, max) {
  const ids = []; let pageToken;
  do {
    const d = await call("playlistItems", { part: "contentDetails", playlistId: pid, maxResults: 50, ...(pageToken ? { pageToken } : {}) });
    (d.items || []).forEach(x => ids.push(x.contentDetails.videoId));
    pageToken = d.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}
const dur = s => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const h = fs.readFileSync("index.html", "utf8");
const onSite = new Set(); for (const n of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) onSite.add(s.slice(i, i + 11)); }
const VMETA = "data/vmeta.json.gz";
const vmeta = fs.existsSync(VMETA) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(VMETA))) : {};
const longIds = new Set(), shortIds = new Set();
// "@handle:N:Name" resolves an official channel by its handle; accepted only if its title contains Name and it has 500k+ subscribers
const resolved = {};
for (const spec of specs) {
  let [ch, lim, name] = spec.split(":"); const max = lim === "all" ? 1e6 : +lim;
  if (ch.startsWith("@")) {
    const d = await call("channels", { part: "snippet,statistics", forHandle: ch });
    const c = (d.items || [])[0];
    const ok = c && (c.snippet.title || "").toLowerCase().includes((name || "").toLowerCase()) && +(c.statistics.subscriberCount || 0) >= 500000;
    console.log("handle", ch, c ? c.id + " " + c.snippet.title + " subs " + c.statistics.subscriberCount : "not found", ok ? "accepted" : "rejected");
    if (!ok) continue;
    ch = c.id; resolved[name] = [c.id];
  }
  const up = await playlistAll("UU" + ch.slice(2), max), sh = await playlistAll("UUSH" + ch.slice(2), max);
  up.forEach(id => longIds.add(id)); sh.forEach(id => shortIds.add(id));
  console.log(ch, "uploads", up.length, "shorts", sh.length);
}
const all = [...new Set([...longIds, ...shortIds])].filter(id => !onSite.has(id));
const info = {};
for (let i = 0; i < all.length; i += 50) {
  const d = await call("videos", { part: "snippet,statistics,contentDetails,status,topicDetails", id: all.slice(i, i + 50).join(","), maxResults: 50 });
  for (const v of d.items || []) {
    const s = v.snippet || {}, st = v.status || {};
    info[v.id] = { views: +((v.statistics || {}).viewCount ?? -1), days: Math.max(0, Math.floor((Date.now() - new Date(s.publishedAt)) / DAY)),
      usable: st.uploadStatus === "processed" && st.privacyStatus === "public" && st.embeddable !== false && (s.liveBroadcastContent || "none") === "none",
      meta: [s.title || "", s.channelId || "", s.channelTitle || "", s.categoryId || "", ((v.topicDetails || {}).topicCategories || []).map(u => u.split("/").pop()), (s.tags || []).slice(0, 12), dur((v.contentDetails || {}).duration)] };
    vmeta[v.id] = info[v.id].meta;
  }
}
const known = Object.values(vmeta), prior = channelPriors(known), kch = koreanChannels(known, []);
const out = { videos: {}, shorts: {} }; let skipped = 0;
const cand = all.filter(id => info[id] && info[id].usable);
const checks = [...cand];
const good = new Set();
await Promise.all(Array.from({ length: 16 }, async () => { while (checks.length) { const id = checks.pop(); if (await hasThumb(id, shortIds.has(id) ? "s" : "v")) good.add(id); } }));
for (const id of cand) {
  if (!good.has(id)) { skipped++; continue; }
  const v = info[id], cat = classify(v.meta, prior, true, kch);
  if (!cat) { skipped++; continue; }
  if (shortIds.has(id)) out.shorts[id] = [cat, v.views, 1, v.days];
  else out.videos[id] = [cat, v.views, v.days, 1];
}
fs.mkdirSync("data", { recursive: true }); fs.writeFileSync(VMETA, zlib.gzipSync(JSON.stringify(vmeta)));
fs.writeFileSync(outPath, JSON.stringify(out));
if (Object.keys(resolved).length) {
  const f = "scripts/artist_channels.json", cur = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  fs.writeFileSync(f, JSON.stringify({ ...cur, ...resolved }, null, 1));
  const cf = "scripts/channels.json", cfg = JSON.parse(fs.readFileSync(cf, "utf8"));
  for (const [n, [id]] of Object.entries(resolved)) if (!cfg.channels.some(c => c.id === id)) cfg.channels.push({ id, name: n, cat: "music" });
  fs.writeFileSync(cf, JSON.stringify(cfg, null, 1));
}
console.log(JSON.stringify({ new_candidates: all.length, videos: Object.keys(out.videos).length, shorts: Object.keys(out.shorts).length, skipped, quota_used: used }));
