// Subtitles (per David 2026-10-30): which videos have real (uploaded, not automatic) captions on YouTube — videos.list
// contentDetails.caption, 1 API unit per 50 videos. Kept in data/captions.json {id: 1|0}; the page gets the ids with
// captions as PRIO_CAP (a 「字幕」/"CC" badge, a "with subtitles" filter and a subtitles button in the player).
// Newest videos first; at most CAP_MAX lookups a run (backfill over a few nights), ids already known are not asked again.
// usage: YT_API_KEY=... node scripts/captions.mjs index.html
import fs from "node:fs";

const KEY = process.env.YT_API_KEY, site = process.argv[2] || "index.html", MAX = +(process.env.CAP_MAX || 10000);
const F = "data/captions.json";
const known = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, "utf8")) : {};
let h = fs.readFileSync(site, "utf8");
const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", dec2 = s => B.indexOf(s[0]) * 64 + B.indexOf(s[1]);
const rows = [];
for (const name of ["FEED", "SHORTS"]) {
  const s = (h.match(new RegExp(`const ${name} = "([^"]*)";`)) || [, ""])[1];
  for (let i = 0; i + 16 <= s.length; i += 16) rows.push({ id: s.slice(i, i + 11), cat: s[i + 11].toLowerCase(), days: dec2(s.slice(i + 14, i + 16)) });
}
const onSite = new Set(rows.map(r => r.id));
const todo = rows.filter(r => !(r.id in known) && r.cat !== "b").sort((a, b) => a.days - b.days).slice(0, MAX).map(r => r.id);
let used = 0, asked = 0, quota = false;
if (KEY && todo.length) {
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    try {
      const r = await fetch("https://www.googleapis.com/youtube/v3/videos?" + new URLSearchParams({ part: "contentDetails", id: batch.join(","), maxResults: 50, key: KEY }));
      const d = await r.json(); used++;
      if (d.error) { const why = ((d.error.errors || [])[0] || {}).reason || ""; console.log("videos.list:", r.status, why); if (/quota/i.test(why)) { quota = true; break } continue; }
      const got = new Set();
      for (const v of d.items || []) { known[v.id] = (v.contentDetails || {}).caption === "true" ? 1 : 0; got.add(v.id); }
      for (const id of batch) if (!got.has(id)) known[id] = 0;   // gone or private
      asked += batch.length;
    } catch (e) { console.log("fetch failed:", e.message); }
  }
}
for (const id of Object.keys(known)) if (!onSite.has(id)) delete known[id];   // keep the file to what is on the site
fs.writeFileSync(F, JSON.stringify(known));
const cap = rows.filter(r => known[r.id] === 1).map(r => r.id);
const line = `const PRIO_CAP = "${[...new Set(cap)].join("")}";`;
if (/const PRIO_CAP = "[^"]*";/.test(h)) h = h.replace(/const PRIO_CAP = "[^"]*";/, () => line);
else { const m = h.match(/const FEED_BUILT = "[^"]*";/); h = h.replace(m[0], () => m[0] + "\n" + line); }
fs.writeFileSync(site, h);
console.log(JSON.stringify({ asked, units: used, quota_hit: quota, known: Object.keys(known).length, with_captions: cap.length, left: rows.filter(r => !(r.id in known) && r.cat !== "b").length }));
