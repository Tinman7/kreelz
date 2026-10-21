// Content statistics for the admin page, written at each 00:00 KST refresh.
// usage: node scripts/catalog_stats.mjs index.html [daily.json]
// stats/catalog.json  — totals now, by category, and what came in with this refresh
// stats/history.json  — one row per refresh (last 120), for the trend charts
import fs from "node:fs";
const [site = "index.html", dailyPath] = process.argv.slice(2);
const h = fs.readFileSync(site, "utf8");
const CAT = { m: "music", d: "screen", f: "screen", e: "ent", b: "beauty", k: "kfood" };
const empty = () => ({ music: 0, screen: 0, ent: 0, beauty: 0, kfood: 0 });
const build = (h.match(/const FEED_BUILT = "([^"]*)"/) || [, ""])[1];
const tot = { shorts: empty(), videos: empty() };
for (const [n, k] of [["SHORTS", "shorts"], ["FEED", "videos"]]) {
  const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1];
  for (let i = 0; i + 16 <= s.length; i += 16) { const c = CAT[s[i + 11].toLowerCase()]; if (c) tot[k][c]++; }
}
const fresh = { shorts: empty(), videos: empty() };
if (dailyPath && fs.existsSync(dailyPath)) {
  const d = JSON.parse(fs.readFileSync(dailyPath, "utf8"));
  const onSite = new Set(); for (const n of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) onSite.add(s.slice(i, i + 11)); }
  const prev = fs.existsSync("stats/known.txt") ? new Set(fs.readFileSync("stats/known.txt", "utf8").split("\n")) : null;
  for (const [k, src] of [["shorts", d.shorts || {}], ["videos", d.videos || {}]])
    for (const [id, v] of Object.entries(src)) { const c = CAT[v[0]]; if (c && onSite.has(id) && (!prev || !prev.has(id))) fresh[k][c]++; }
}
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const catalog = {
  build, generated_at: new Date().toISOString(),
  total: { all: sum(tot.shorts) + sum(tot.videos), shorts: sum(tot.shorts), videos: sum(tot.videos) },
  by_category: Object.fromEntries(Object.keys(empty()).map(c => [c, { shorts: tot.shorts[c], videos: tot.videos[c], all: tot.shorts[c] + tot.videos[c] }])),
  new_today: { all: sum(fresh.shorts) + sum(fresh.videos), shorts: sum(fresh.shorts), videos: sum(fresh.videos),
    by_category: Object.fromEntries(Object.keys(empty()).map(c => [c, { shorts: fresh.shorts[c], videos: fresh.videos[c], all: fresh.shorts[c] + fresh.videos[c] }])) },
};
fs.mkdirSync("stats", { recursive: true });
fs.writeFileSync("stats/catalog.json", JSON.stringify(catalog, null, 1));
const hist = fs.existsSync("stats/history.json") ? JSON.parse(fs.readFileSync("stats/history.json", "utf8")) : [];
const row = { day: build, total: catalog.total.all, shorts: catalog.total.shorts, videos: catalog.total.videos, new: catalog.new_today.all,
  new_by_category: Object.fromEntries(Object.entries(catalog.new_today.by_category).map(([c, v]) => [c, v.all])) };
const i = hist.findIndex(r => r.day === build); if (i >= 0) hist[i] = row; else hist.push(row);
fs.writeFileSync("stats/history.json", JSON.stringify(hist.slice(-120)));
// ids on the site now, so tomorrow's "new" counts only what is really new
const ids = []; for (const n of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) ids.push(s.slice(i, i + 11)); }
fs.writeFileSync("stats/known.txt", ids.join("\n"));
console.log(JSON.stringify({ build, total: catalog.total, new_today: catalog.new_today.all }));
