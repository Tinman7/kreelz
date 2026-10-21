// Re-decide the category of every video on the site with scripts/classify.mjs and rewrite FEED/SHORTS.
// usage: node scripts/recat_apply.mjs index.html data/vmeta.json.gz index.html
import fs from "node:fs"; import zlib from "node:zlib";
import { classify, channelPriors, koreanChannels } from "./classify.mjs";
const [site, metaPath, out] = process.argv.slice(2);
const M = JSON.parse(zlib.gunzipSync(fs.readFileSync(metaPath)));
let h = fs.readFileSync(site, "utf8");
const cfg = JSON.parse(fs.readFileSync("scripts/channels.json", "utf8"));
const get = n => h.match(new RegExp(`const ${n} = "([^"]*)";`));
const rows = []; for (const n of ["SHORTS", "FEED"]) { const s = get(n)[1]; for (let i = 0; i + 16 <= s.length; i += 16) rows.push([n, s.slice(i, i + 16)]); }
const metas = rows.map(r => M[r[1].slice(0, 11)]);
const prior = channelPriors(metas);
const officialCh = new Set(cfg.channels.filter(c => !["beauty", "mukbang"].includes(c.cat)).map(c => c.id));
rows.forEach(([, r]) => { const m = M[r.slice(0, 11)]; if (m && r[11] !== r[11].toLowerCase()) officialCh.add(m[1]); });
const kch = koreanChannels(metas, []);
const res = { SHORTS: [], FEED: [] }, moves = {}, kept = {};
for (const [n, r] of rows) {
  const id = r.slice(0, 11), old = r[11], m = M[id];
  if (m === undefined) { res[n].push(r); continue; }            // no metadata yet (new today): leave as it is
  const off = !!m && officialCh.has(m[1]);
  let nc = classify(m, prior, off, kch);
  if (nc && "mdfe".includes(nc) && "bk".includes(old.toLowerCase()) && !off) nc = null;  // music/screen/shows only from official channels
  const key = old.toLowerCase() + ">" + (nc || "x"); moves[key] = (moves[key] || 0) + 1;
  if (!nc) continue;
  const ch = old !== old.toLowerCase() ? nc.toUpperCase() : nc;
  kept[nc] = (kept[nc] || 0) + 1;
  res[n].push(id + ch + r.slice(12));
}
for (const n of ["SHORTS", "FEED"]) h = h.replace(get(n)[0], `const ${n} = "${res[n].join("")}";`);
fs.writeFileSync(out, h);
const changed = Object.entries(moves).filter(([k]) => k[0] !== k[2]).reduce((a, [, v]) => a + v, 0);
console.log(JSON.stringify({ total: rows.length, changed, removed: Object.entries(moves).filter(([k]) => k.endsWith("x")).reduce((a, [, v]) => a + v, 0), now: kept, shorts: res.SHORTS.length, videos: res.FEED.length }));
