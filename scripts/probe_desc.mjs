// Diagnostics: title, length, upload day and description start of the video ids in a JSON array (1 API unit per 50 ids).
// usage: YT_API_KEY=... node scripts/probe_desc.mjs probe/ids.json > probe.txt
import fs from "node:fs";
const KEY = process.env.YT_API_KEY, ids = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (let i = 0; i < ids.length; i += 50) {
  const r = await fetch("https://www.googleapis.com/youtube/v3/videos?" + new URLSearchParams({ part: "snippet,contentDetails", id: ids.slice(i, i + 50).join(","), key: KEY }));
  for (const v of (await r.json()).items || []) console.log([v.id, v.contentDetails.duration, v.snippet.title, v.snippet.publishedAt.slice(0, 10), (v.snippet.description || "").replace(/\s+/g, " ").slice(0, 400)].join("\t"));
}
