// What is taking off right now (per David 2026-11-02: "조회수 많고 공유 많이 되는 것들 위주로, 같은 것들을 처음 화면에 계속
//띄워놓지 말고"). Every night the view, like and comment counts of the clips of the last 14 days are read again
// (videos.list statistics, 1 API unit per 50 clips) and compared with the night before: the clips that gained the most
// views in the last day — weighted up a little when many viewers like or comment — lead the first screen of All, Music,
// Screen and Shows the next day. YouTube does not publish share counts, so likes and comments stand in for them.
// Screen / Film clips posted for fans abroad count 1.5x. Output: PRIO_VIRAL (ids, best first) in index.html; data/views.json keeps the counts of the night before.
// The views in FEED/SHORTS are refreshed with the new counts too. usage: YT_API_KEY=... node scripts/viral.mjs index.html
import fs from "node:fs";
import zlib from "node:zlib";

const KEY = process.env.YT_API_KEY, site = process.argv[2] || "index.html";
const WINDOW = +(process.env.VIRAL_DAYS || 14), TOP = +(process.env.VIRAL_TOP || 600);
const F = "data/views.json";
const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const enc2 = n => B[Math.floor(n / 64)] + B[n % 64], dec2 = s => B.indexOf(s[0]) * 64 + B.indexOf(s[1]);
const vcode = v => v < 0 ? 4095 : Math.min(4094, Math.round(Math.log(v + 1) / Math.log(1.006)));
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch {}
// dramas and films posted for fans abroad (a title with no Korean: Netflix global, fan edits) count 1.5x (per David 2026-11-02)
const abroad = r => (r.cat === "d" || r.cat === "f") && vm[r.id] && vm[r.id][0] && !/[\uac00-\ud7a3]/.test(vm[r.id][0]);
const prev = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, "utf8")) : { day: "", v: {} };
let h = fs.readFileSync(site, "utf8");
const rows = [];
for (const name of ["FEED", "SHORTS"]) {
  const s = (h.match(new RegExp(`const ${name} = "([^"]*)";`)) || [, ""])[1];
  for (let i = 0; i + 16 <= s.length; i += 16) { const days = dec2(s.slice(i + 14, i + 16)); if (days <= WINDOW) rows.push({ name, id: s.slice(i, i + 11), cat: s[i + 11].toLowerCase(), days }); }
}
const ids = [...new Set(rows.map(r => r.id))];
const now = {}; let units = 0, quota = false;
if (KEY) for (let i = 0; i < ids.length && !quota; i += 50) {
  try {
    const r = await fetch("https://www.googleapis.com/youtube/v3/videos?" + new URLSearchParams({ part: "statistics", id: ids.slice(i, i + 50).join(","), maxResults: 50, key: KEY }));
    const d = await r.json(); units++;
    if (d.error) { if (/quota/i.test(JSON.stringify(d.error))) quota = true; continue; }
    for (const v of d.items || []) { const st = v.statistics || {}; now[v.id] = [+st.viewCount || 0, +st.likeCount || 0, +st.commentCount || 0]; }
  } catch (e) { console.log("fetch failed:", e.message); }
}
if (!Object.keys(now).length) { console.log(JSON.stringify({ viral: "no counts (no key or quota)", units })); process.exit(0); }
// one day of growth: views now minus views the night before (a clip seen for the first time: its views per day so far)
const gap = prev.day ? Math.max(1, Math.round((Date.parse(today) - Date.parse(prev.day)) / 864e5)) : 1;
const score = {};
for (const r of rows) {
  const n = now[r.id]; if (!n || r.id in score) continue;
  const p = prev.v[r.id], gain = p ? Math.max(0, n[0] - p[0]) / gap : n[0] / (r.days + 1);
  const eng = n[0] ? (n[1] + 3 * n[2]) / n[0] : 0;   // likes and comments per view
  score[r.id] = gain * (1 + Math.min(1, eng * 10)) * (abroad(r) ? 1.5 : 1);
}
const best = Object.keys(score).filter(id => score[id] > 0).sort((a, b) => score[b] - score[a]).slice(0, TOP);
// fresh view counts into FEED / SHORTS
for (const name of ["FEED", "SHORTS"]) {
  const m = h.match(new RegExp(`const ${name} = "([^"]*)";`)); if (!m) continue; const s = m[1]; let o = "";
  for (let i = 0; i + 16 <= s.length; i += 16) { const id = s.slice(i, i + 11), n = now[id];
    o += n && n[0] > 0 ? s.slice(i, i + 12) + enc2(Math.max(dec2(s.slice(i + 12, i + 14)) === 4095 ? 0 : dec2(s.slice(i + 12, i + 14)), vcode(n[0]))) + s.slice(i + 14, i + 16) : s.slice(i, i + 16); }
  h = h.replace(m[0], () => `const ${name} = "${o}";`);
}
const line = `const PRIO_VIRAL = "${best.join("")}";`;
if (/const PRIO_VIRAL = "[^"]*";/.test(h)) h = h.replace(/const PRIO_VIRAL = "[^"]*";/, () => line);
else { const m = h.match(/const FEED_BUILT = "[^"]*";/); h = h.replace(m[0], () => m[0] + "\n" + line); }
fs.writeFileSync(site, h);
fs.writeFileSync(F, JSON.stringify({ day: today, v: now }));
const cat = {}; for (const id of best.slice(0, 60)) { const r = rows.find(x => x.id === id); cat[r.cat] = (cat[r.cat] || 0) + 1; }
console.log(JSON.stringify({ checked: Object.keys(now).length, units, quota_hit: quota, compared_with: prev.day || "none", top: best.length, top60_by_cat: cat }));
