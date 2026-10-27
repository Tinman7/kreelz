// Diagnostics: title, length, upload day and description start of videos (1 API unit per 50).
// usage: YT_API_KEY=... node scripts/probe_desc.mjs probe/ids.json > probe.txt      (a JSON array of video ids)
//        YT_API_KEY=... node scripts/probe_desc.mjs UCxxxx > probe.txt              (a channel: its latest 200 uploads and 200 shorts)
import fs from "node:fs";
const KEY = process.env.YT_API_KEY, A = process.argv[2];
const api = async (ep, p) => (await fetch(`https://www.googleapis.com/youtube/v3/${ep}?` + new URLSearchParams({ ...p, key: KEY }))).json();
let ids = [];
if (/^UC/.test(A)) {
  for (const pre of ["UU", "UUSH"]) { let t, n = 0; do { const d = await api("playlistItems", { part: "contentDetails", playlistId: pre + A.slice(2), maxResults: 50, ...(t ? { pageToken: t } : {}) });
    (d.items || []).forEach(x => { ids.push(x.contentDetails.videoId); n++ }); t = d.nextPageToken; } while (t && n < 200); }
  ids = [...new Set(ids)];
} else ids = JSON.parse(fs.readFileSync(A, "utf8"));
for (let i = 0; i < ids.length; i += 50) {
  const d = await api("videos", { part: "snippet,contentDetails", id: ids.slice(i, i + 50).join(",") });
  for (const v of d.items || []) console.log([v.id, v.contentDetails.duration, v.snippet.title, v.snippet.publishedAt.slice(0, 10), (v.snippet.description || "").replace(/\s+/g, " ").slice(0, 400)].join("\t"));
}
