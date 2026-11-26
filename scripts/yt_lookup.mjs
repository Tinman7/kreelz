// one-off lookups for clips David asks for (videos.list = 1 unit per 50; a channel's latest uploads = 2 units):
//   IDS=a,b,c CH_OF=<id whose channel's latest uploads to list> node scripts/yt_lookup.mjs
const KEY = process.env.YT_API_KEY, API = "https://www.googleapis.com/youtube/v3/";
const get = async (ep, p) => (await fetch(API + ep + "?" + new URLSearchParams({ ...p, key: KEY }))).json();
const info = async ids => (await get("videos", { part: "snippet,statistics,contentDetails", id: ids.join(","), maxResults: 50 })).items?.map(v => ({
  id: v.id, t: v.snippet.title, ch: v.snippet.channelTitle, chId: v.snippet.channelId, at: v.snippet.publishedAt, views: +v.statistics.viewCount, dur: v.contentDetails.duration })) || [];
const chk = async id => { const r = await fetch("https://www.youtube.com/shorts/" + id, { method: "HEAD", redirect: "manual" }).catch(() => ({ status: 0 }));
  const o = await fetch("https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=" + id).catch(() => ({ status: 0 }));
  return { short: r.status === 200, embed: o.status }; };
const ids = (process.env.IDS || "").split(",").filter(Boolean);
const a = ids.length ? await info(ids) : []; for (const x of a) Object.assign(x, await chk(x.id)); console.log(JSON.stringify(a, null, 1));
if (process.env.CH_OF) { const c = a.find(x => x.id === process.env.CH_OF);
  if (c) { const pl = await get("playlistItems", { part: "contentDetails", playlistId: "UU" + c.chId.slice(2), maxResults: 25 });
    console.log("LATEST", JSON.stringify(await info(pl.items.map(x => x.contentDetails.videoId)), null, 1)); } }
// Q="query one|query two" AFTER=2026-11-25 → YouTube search (100 units per query), results with views / length / short check
if (process.env.Q) for (const q of process.env.Q.split("|").filter(Boolean)) {
  const s = await get("search", { part: "id", type: "video", q, maxResults: 25, order: "relevance", ...(process.env.AFTER ? { publishedAfter: process.env.AFTER + "T00:00:00Z" } : {}) });
  if (s.error) { console.log("SEARCH", q, "error:", s.error.message); continue; }
  const r = await info((s.items || []).map(x => x.id.videoId)); for (const x of r) Object.assign(x, await chk(x.id));
  console.log("SEARCH", q); for (const x of r.sort((a, b) => b.views - a.views)) console.log(` ${x.id} ${x.views} ${x.dur} short=${x.short} embed=${x.embed} | ${x.ch} | ${x.t}`);
}
