// KREELZ — nightly collector over the official YouTube Data API v3.
// usage: YT_API_KEY=... node scripts/collect.mjs scripts/channels.json daily.json
// Output: {at, videos:{id:[cat,views,days,ok]}, shorts:{id:[cat,views,ok]}, used} — read by daily_merge.py.
// Quota (free 10,000 units/day): playlistItems.list 1, videos.list 1 per 50 ids, search.list 100.
import fs from "node:fs";

const KEY = process.env.YT_API_KEY;
if (!KEY) { console.error("YT_API_KEY is not set"); process.exit(1); }
const [cfgPath = "scripts/channels.json", outPath = "daily.json"] = process.argv.slice(2);
const { channels, beautyQ = [], mukbangQ = [] } = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

const API = "https://www.googleapis.com/youtube/v3/";
const CATC = { music: "m", drama: "d", film: "f", beauty: "b", mukbang: "k", entertainment: "e", events: "m" };
const DAY = 864e5, MAX_AGE = 3, SHORT_MAX_S = 180;
let used = 0;

async function call(ep, params, cost) {
  used += cost;
  for (let tries = 0; ; tries++) {
    const r = await fetch(API + ep + "?" + new URLSearchParams({ ...params, key: KEY }));
    const d = await r.json().catch(() => ({}));
    if (!d.error) return d;
    const reason = (d.error.errors || [])[0]?.reason || "";
    if (/quota/i.test(reason)) throw new Error("QUOTA: " + d.error.message);
    if (r.status >= 500 && tries < 2) { await new Promise(s => setTimeout(s, 3000)); continue; }
    throw new Error(ep + " " + r.status + " " + reason + ": " + d.error.message);
  }
}
const dur = s => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };

async function details(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const d = await call("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(","), maxResults: 50 }, 1);
    for (const v of d.items || []) out[v.id] = {
      views: +((v.statistics || {}).viewCount ?? -1),
      days: Math.max(0, Math.floor((Date.now() - new Date(v.snippet.publishedAt)) / DAY)),
      secs: dur((v.contentDetails || {}).duration),
      ch: v.snippet.channelId,
    };
  }
  return out;
}
async function playlist(pid) {               // newest 50 items; [] if the playlist doesn't exist
  try { const d = await call("playlistItems", { part: "contentDetails", playlistId: pid, maxResults: 50 }, 1);
        return (d.items || []).map(x => x.contentDetails.videoId); }
  catch (e) { if (String(e.message).startsWith("QUOTA")) throw e; return []; }
}

const official = new Set(channels.map(c => c.id));
const catOf = Object.fromEntries(channels.map(c => [c.id, CATC[c.cat] || "m"]));
const creator = new Set(channels.filter(c => c.cat === "beauty" || c.cat === "mukbang").map(c => c.id));
const longIds = new Set(), shortIds = new Set(), searchCat = {};
let failed = 0;

for (const c of channels) {
  if (!/^UC[\w-]{22}$/.test(c.id)) continue;
  const tail = c.id.slice(2);
  const up = await playlist("UU" + tail);   // all uploads, newest first
  const sh = await playlist("UUSH" + tail); // the channel's shorts
  if (!up.length && !sh.length) failed++;
  up.forEach(id => longIds.add(id)); sh.forEach(id => shortIds.add(id));
}
const since = new Date(Date.now() - MAX_AGE * DAY).toISOString();
for (const [qs, c] of [[beautyQ, "b"], [mukbangQ, "k"]]) for (const q of qs) {
  const d = await call("search", { part: "id", q, type: "video", order: "date", regionCode: "KR", relevanceLanguage: "ko", publishedAfter: since, maxResults: 50 }, 100);
  for (const x of d.items || []) if (x.id?.videoId) searchCat[x.id.videoId] = c;
}
const all = [...new Set([...longIds, ...shortIds, ...Object.keys(searchCat)])];
const info = await details(all);
const out = { at: new Date().toISOString(), videos: {}, shorts: {}, used: 0 };
for (const id of all) {
  const v = info[id]; if (!v) continue;                       // deleted or private
  const ok = official.has(v.ch) && !creator.has(v.ch);
  const cat = official.has(v.ch) ? catOf[v.ch] : searchCat[id];
  if (!cat) continue;                                         // music/screen/entertainment only from listed official channels
  const isShort = shortIds.has(id) || (v.secs > 0 && v.secs <= SHORT_MAX_S && !longIds.has(id)) ;
  if (isShort) { if (v.days <= MAX_AGE) out.shorts[id] = [cat, v.views, ok ? 1 : 0]; }
  else if (v.days <= MAX_AGE) out.videos[id] = [cat, v.views, v.days, ok ? 1 : 0];
}
out.used = used;
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(JSON.stringify({ channels: channels.length, empty_channels: failed, candidates: all.length,
  videos: Object.keys(out.videos).length, shorts: Object.keys(out.shorts).length, quota_used: used }));
