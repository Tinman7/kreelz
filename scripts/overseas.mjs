// Dramas and films that fans abroad respond to (per David 2026-11-02: "영화나 드라마는 해외 팬들한테서 반응이 있거나 댓글이
// 있거나 해외 팬들이 게시한 걸, 국내에서만 알려진 것들은 선별해서 빼야"). Both editions, Screen and Film clips (cat d/f):
//  - a title with no Korean in it was posted for fans abroad (Netflix global, fan edits, Japanese uploads): kept, no API call
//  - otherwise the 50 most relevant comments are read (commentThreads.list, 1 API unit): the share written in other
//    languages is kept in data/overseas.json; clips that fans abroad don't comment on are taken off the site
//    (under 20% of the comments, or under 5 comments in all and under 100,000 views). Comments turned off: kept.
// Clips are judged once they are 2 days old, newest first, at most OVS_MAX a night (the rest over the next nights).
// usage: YT_API_KEY=... node scripts/overseas.mjs index.html [--dry]
import fs from "node:fs";
import zlib from "node:zlib";

const KEY = process.env.YT_API_KEY, site = process.argv[2] || "index.html", dry = process.argv.includes("--dry");
const MAX = +(process.env.OVS_MAX || 300), F = "data/overseas.json";
const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", dec2 = s => B.indexOf(s[0]) * 64 + B.indexOf(s[1]);
const sh = id => ((B.indexOf(id[0]) * 64 + B.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
const known = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, "utf8")) : {};   // id -> [share %, comments read] | "t" (title for abroad) | "off"
let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch {}
const S = {}; const tO = id => { const k = sh(id); if (!(k in S)) { try { S[k] = JSON.parse(fs.readFileSync(`t/o/${k}.json`, "utf8")) } catch { S[k] = {} } } return S[k][id] };
const HAN = /[가-힣]/, LETTER = /[\p{L}]/u;
let h = fs.readFileSync(site, "utf8");
const rows = [];
for (const name of ["FEED", "SHORTS"]) {
  const s = (h.match(new RegExp(`const ${name} = "([^"]*)";`)) || [, ""])[1];
  for (let i = 0; i + 16 <= s.length; i += 16) { const c = s[i + 11].toLowerCase(); if (c !== "d" && c !== "f") continue;
    const vc = dec2(s.slice(i + 12, i + 14)); rows.push({ id: s.slice(i, i + 11), days: dec2(s.slice(i + 14, i + 16)), views: vc === 4095 ? 0 : Math.round(Math.pow(1.006, vc) - 1) }); }
}
const title = id => (vm[id] && vm[id][0]) || (tO(id) || [])[0] || "";
let units = 0, quota = false, byTitle = 0, read = 0;
for (const r of rows) if (!(r.id in known) && title(r.id) && !HAN.test(title(r.id))) { known[r.id] = "t"; byTitle++; }
const todo = rows.filter(r => !(r.id in known) && r.days >= 2).sort((a, b) => a.days - b.days).slice(0, KEY ? MAX : 0);
for (const r of todo) {
  if (quota) break;
  try {
    const res = await fetch("https://www.googleapis.com/youtube/v3/commentThreads?" + new URLSearchParams({ part: "snippet", videoId: r.id, maxResults: 50, order: "relevance", textFormat: "plainText", key: KEY }));
    const d = await res.json(); units++;
    if (d.error) { const why = JSON.stringify(d.error); if (/quota/i.test(why)) { quota = true; break } known[r.id] = "off"; continue; }   // comments turned off (or the clip is gone): not judged
    const texts = (d.items || []).map(x => ((x.snippet || {}).topLevelComment || {}).snippet?.textDisplay || "").filter(t => LETTER.test(t));
    const abroad = texts.filter(t => !HAN.test(t)).length;
    known[r.id] = [texts.length ? Math.round(abroad / texts.length * 100) : 0, texts.length]; read++;
  } catch (e) { console.log("comments failed:", e.message); }
}
const local = r => { const k = known[r.id]; if (!Array.isArray(k)) return false;
  return (k[1] >= 5 && k[0] < 20) || (k[1] < 5 && r.views < 100000); };
const drop = new Set(rows.filter(local).map(r => r.id));
if (!dry) {
  for (const name of ["FEED", "SHORTS"]) {
    const m = h.match(new RegExp(`const ${name} = "([^"]*)";`)); if (!m) continue; const s = m[1]; let o = "";
    for (let i = 0; i + 16 <= s.length; i += 16) if (!drop.has(s.slice(i, i + 11))) o += s.slice(i, i + 16);
    h = h.replace(m[0], () => `const ${name} = "${o}";`);
  }
  fs.writeFileSync(site, h);
  fs.writeFileSync(F, JSON.stringify(known));
}
const judged = rows.filter(r => r.id in known).length;
console.log(JSON.stringify({ screen_film_clips: rows.length, judged, title_for_abroad: byTitle, comments_read_tonight: read, units, quota_hit: quota, taken_off: drop.size, left_to_judge: rows.filter(r => !(r.id in known)).length }));
