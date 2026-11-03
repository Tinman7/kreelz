// Clips that can't play in our player (per David 2026-11-03: "재생 안 되는 영상 정리"): every night a third of the site
// (and every clip added in the last 2 days) is checked with YouTube's oEmbed endpoint — no API quota. YouTube answers
//   200  playable in other sites' players
//   401  the uploader turned off embedding (our player shows "Video unavailable")
//   403  private            404  deleted / never existed
// 401 / 403 / 404 are taken off the site (the next step, drop_ids.py). Anything else (429, 5xx, timeouts) is "unknown" and
// kept. Safety: if more than 8 % of the checked clips come back bad, something is off (YouTube blocking us) and nothing
// is dropped. Report: data/playcheck.json (admin page) — how many checked, removed, why, and a few examples.
// usage: node scripts/play_check.mjs index.html bad.json [--sample N] [--all]
import fs from "node:fs";

const [site = "index.html", outPath = "bad_play.json"] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const SAMPLE = +(process.argv.find(a => a.startsWith("--sample="))?.split("=")[1] || 0), ALL = process.argv.includes("--all");
const h = fs.readFileSync(site, "utf8");
const str = n => (new RegExp(`const ${n} = "([^"]*)"`).exec(h) || [])[1] || "";
const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", dec2 = s => B.indexOf(s[0]) * 64 + B.indexOf(s[1]);
const day = Math.floor(Date.now() / 864e5);
const jobs = [];
for (const name of ["FEED", "SHORTS"]) {
  const s = str(name);
  for (let i = 0; i + 16 <= s.length; i += 16) {
    const id = s.slice(i, i + 11), days = dec2(s.slice(i + 14, i + 16));
    const third = (B.indexOf(id[0]) * 64 + B.indexOf(id[1])) % 3 === day % 3;
    if (ALL || third || days <= 2) jobs.push(id);
  }
}
let list = [...new Set(jobs)];
if (SAMPLE) list = list.sort(() => Math.random() - 0.5).slice(0, SAMPLE);
const total = list.length, why = { 401: [], 403: [], 404: [] };
let ok = 0, unknown = 0, done = 0;
async function check(id) {
  for (let t = 0; t < 2; t++) {
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`,
        { signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0 (compatible; KREELZ playability check)" } });
      if (r.status === 200) return 200;
      if (r.status === 401 || r.status === 403 || r.status === 404) return r.status;
      if (r.status === 400) return 404;   // malformed / removed id
      await new Promise(s => setTimeout(s, 1500 * (t + 1)));
    } catch (e) { await new Promise(s => setTimeout(s, 1000)); }
  }
  return 0;
}
await Promise.all(Array.from({ length: 24 }, async () => {
  while (list.length) {
    const id = list.pop(), c = await check(id);
    if (c === 200) ok++; else if (why[c]) why[c].push(id); else unknown++;
    if (++done % 5000 === 0) console.log(done, "/", total);
  }
}));
const bad = [...why[401], ...why[403], ...why[404]];
const safe = total > 0 && bad.length / total <= 0.08 && unknown / total <= 0.3;
fs.writeFileSync(outPath, JSON.stringify(safe && !SAMPLE ? bad : []));
const rep = { date: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), checked: total, ok, unknown,
  no_embed: why[401].length, private: why[403].length, deleted: why[404].length, removed: safe && !SAMPLE ? bad.length : 0,
  held_back: !safe, examples: { no_embed: why[401].slice(0, 5), private: why[403].slice(0, 5), deleted: why[404].slice(0, 5) } };
if (!SAMPLE) {
  let hist = []; try { hist = JSON.parse(fs.readFileSync("data/playcheck.json", "utf8")).history || []; } catch (e) {}
  hist = [...hist.filter(x => x.date !== rep.date), { date: rep.date, checked: total, removed: rep.removed }].slice(-30);
  fs.writeFileSync("data/playcheck.json", JSON.stringify({ ...rep, history: hist }, null, 1) + "\n");
}
console.log(JSON.stringify(rep));
