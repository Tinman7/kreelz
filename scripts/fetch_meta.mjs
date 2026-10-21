// Fetch classification signals for every video on the site (YouTube Data API, free quota: 1 unit per 50 videos).
// usage: YT_API_KEY=... node scripts/fetch_meta.mjs index.html data/vmeta.json.gz
// Output rows: id -> [title, channelId, channelTitle, categoryId, topics[], tags[] (first 12), durationSecs]
import fs from "node:fs";
import zlib from "node:zlib";
const KEY = process.env.YT_API_KEY; if (!KEY) { console.error("YT_API_KEY missing"); process.exit(1); }
const [site = "index.html", out = "data/vmeta.json.gz"] = process.argv.slice(2);
const h = fs.readFileSync(site, "utf8");
const ids = [];
for (const n of ["SHORTS", "FEED"]) { const s = (h.match(new RegExp(`const ${n} = "([^"]*)";`)) || [, ""])[1]; for (let i = 0; i + 16 <= s.length; i += 16) ids.push(s.slice(i, i + 11)); }
const old = fs.existsSync(out) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(out))) : {};
const need = [...new Set(ids)].filter(id => !old[id]);
const dur = s => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const batches = []; for (let i = 0; i < need.length; i += 50) batches.push(need.slice(i, i + 50));
let calls = 0, got = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (batches.length) {
    const b = batches.pop();
    for (let t = 0; t < 4; t++) {
      const r = await fetch("https://www.googleapis.com/youtube/v3/videos?" + new URLSearchParams({ key: KEY, part: "snippet,topicDetails,contentDetails", id: b.join(","), maxResults: 50 }));
      const d = await r.json().catch(() => ({}));
      if (d.error) { if (/quota/i.test(JSON.stringify(d.error))) throw new Error("quota"); await new Promise(s => setTimeout(s, 2000 * (t + 1))); continue; }
      calls++;
      const seen = new Set();
      for (const v of d.items || []) {
        const s = v.snippet || {};
        seen.add(v.id); got++;
        old[v.id] = [s.title || "", s.channelId || "", s.channelTitle || "", s.categoryId || "",
          ((v.topicDetails || {}).topicCategories || []).map(u => u.split("/").pop()), (s.tags || []).slice(0, 12), dur((v.contentDetails || {}).duration)];
      }
      b.forEach(id => { if (!seen.has(id)) old[id] = null; });   // deleted / private
      break;
    }
  }
}));
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(old)));
console.log(JSON.stringify({ ids: ids.length, fetched: need.length, got, calls }));
