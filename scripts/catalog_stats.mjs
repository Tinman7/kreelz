// Content statistics for the admin page, written at each 00:00 KST refresh.
// usage: node scripts/catalog_stats.mjs index.html [daily.json ...]
// stats/catalog.json  — totals now, by category, and what came in with this refresh
// stats/history.json  — one row per refresh (last 120), for the trend charts
// stats/sources.json  — where the links come from: platform, collection step, channel
import fs from "node:fs"; import zlib from "node:zlib";
const [site = "index.html", ...dailyPaths] = process.argv.slice(2);
const h = fs.readFileSync(site, "utf8");
const CAT = { m: "music", d: "screen", f: "screen", e: "ent", b: "beauty", k: "kfood" };
const empty = () => ({ music: 0, screen: 0, ent: 0, beauty: 0, kfood: 0 });
const build = (h.match(/const FEED_BUILT = "([^"]*)"/) || [, ""])[1];
const tot = { shorts: empty(), videos: empty() };
for (const [n, k] of [["SHORTS", "shorts"], ["FEED", "videos"]]) {
  const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1];
  for (let i = 0; i + 16 <= s.length; i += 16) { const c = CAT[s[i + 11].toLowerCase()]; if (c) tot[k][c]++; }
}
// TikTok shorts added on the admin page (const TIKTOK, written by scripts/tiktok.mjs): [videoId, account, cat, title, added]
const TT = (() => { const m = h.match(/^const TIKTOK = (.*);$/m); try { return m ? JSON.parse(m[1]) : []; } catch { return []; } })();
for (const [, , c] of TT) if (CAT[c]) tot.shorts[CAT[c]]++;
const prevKnown = fs.existsSync("stats/known.txt") ? new Set(fs.readFileSync("stats/known.txt", "utf8").split("\n")) : null;
const fresh = { shorts: empty(), videos: empty() }, counted = new Set();   // a video found by two collection steps counts once
for (const dailyPath of dailyPaths) if (fs.existsSync(dailyPath)) {
  const d = JSON.parse(fs.readFileSync(dailyPath, "utf8"));
  const onSite = new Set(); for (const n of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) onSite.add(s.slice(i, i + 11)); }
  const prev = fs.existsSync("stats/known.txt") ? new Set(fs.readFileSync("stats/known.txt", "utf8").split("\n")) : null;
  for (const [k, src] of [["shorts", d.shorts || {}], ["videos", d.videos || {}]])
    for (const [id, v] of Object.entries(src)) { const c = CAT[v[0]]; if (c && onSite.has(id) && (!prev || !prev.has(id)) && !counted.has(id)) { counted.add(id); fresh[k][c]++; } }
}
for (const [vid, , c] of TT) if (CAT[c] && prevKnown && !prevKnown.has("tt:" + vid)) fresh.shorts[CAT[c]]++;
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
// where every link on the site comes from (platform, collection route, channel) -> stats/sources.json
try { sourceStats(); } catch (e) { console.error("sources:", e.message); }
// ids on the site now, so tomorrow's "new" counts only what is really new
const ids = []; for (const n of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) ids.push(s.slice(i, i + 11)); }
for (const [vid] of TT) ids.push("tt:" + vid);
fs.writeFileSync("stats/known.txt", ids.join("\n"));
// shorts ids (11 chars each), so the admin page can split its rankings into shorts and regular videos
fs.writeFileSync("stats/shorts.txt", h.match(/const SHORTS = "([^"]*)";/)[1].match(/.{16}/g).map(r => r.slice(0, 11)).join(""));
console.log(JSON.stringify({ build, total: catalog.total, new_today: catalog.new_today.all }));

// stats/sources.json: platform (YouTube / TikTok / Naver TV) of every link on the site and of today's new ones,
// which collection step brought today's new videos in, and the uploading channels.
// Feed and shorts are YouTube ids (from data/vmeta.json.gz: [title, channelId, channelName, ...]);
// the per-title official video lists (const VIDEOS) carry their own platform and uploader.
function sourceStats() {
  const PLAT = { yt: "YouTube", tt: "TikTok", nv: "NAVER Clip" };   // NAVER TV dropped for NAVER Clip (2026-10-27)
  const ROUTE = {
    "daily.json": "공식 채널 정기 수집 (YouTube Data API)", "fans.json": "팬 영상 (보이그룹 직캠·커버·팬 편집)",
    "idol_shows.json": "우선 아이돌 인터뷰·방송·시상식", "actors.json": "집중 배우 영상",
    "actor_fancams.json": "집중 배우 직캠 (팬미팅·행사·공항)", "creators.json": "개인 크리에이터 인기 영상",
    "ott.json": "OTT 공식 채널 (Netflix·TVING·Disney+·쿠팡플레이·wavve)", "seventeen.json": "세븐틴 공식 채널 보충",
  };
  const meta = fs.existsSync("data/vmeta.json.gz") ? JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))) : {};
  const recs = n => (h.match(new RegExp(`const ${n} = "([^"]*)";`)) || [, ""])[1].match(/.{16}/g) || [];
  const shorts = recs("SHORTS").map(r => r.slice(0, 11)), feed = recs("FEED").map(r => r.slice(0, 11));
  const vm = h.match(/^const VIDEOS = (\{.*\});\s*$/m), curated = [];
  if (vm) for (const list of Object.values(JSON.parse(vm[1]))) for (const [p, id, , ch] of list) curated.push({ p, id, ch: ch || "" });
  const prevKnown = fs.existsSync("stats/known.txt") ? new Set(fs.readFileSync("stats/known.txt", "utf8").split("\n")) : null;
  const prevCur = fs.existsSync("stats/known_curated.txt") ? new Set(fs.readFileSync("stats/known_curated.txt", "utf8").split("\n")) : null;
  // which collection step each of today's ids came from (first file wins, same order as the workflow)
  const route = new Map();
  for (const p of dailyPaths) if (fs.existsSync(p)) {
    const d = JSON.parse(fs.readFileSync(p, "utf8")), name = p.split("/").pop();
    for (const src of [d.shorts || {}, d.videos || {}]) for (const id of Object.keys(src)) if (!route.has(id)) route.set(id, name);
  }
  const zero = () => Object.fromEntries(Object.values(PLAT).map(v => [v, 0]));
  const plat = { total: { all: zero(), shorts: zero(), videos: zero(), curated: zero() }, new: { all: zero(), shorts: zero(), videos: zero(), curated: zero() } };
  const chAll = new Map(), chNew = new Map(), routes = {};
  const bump = (m, key, name, url, platform) => { const c = m.get(key) || { name, url, platform, n: 0 }; c.n++; m.set(key, c); };
  const ytCh = id => { const m = meta[id]; return m ? [m[1], m[2] || m[1]] : ["?", "(채널 정보 없음)"]; };
  const seen = new Set();
  for (const [kind, list] of [["shorts", shorts], ["videos", feed]]) for (const id of list) {
    const isNew = route.has(id) && (!prevKnown || !prevKnown.has(id));   // same rule as catalog.json "new_today"
    plat.total[kind].YouTube++; if (isNew) plat.new[kind].YouTube++;
    if (seen.has(id)) continue; seen.add(id);
    plat.total.all.YouTube++;
    const [cid, cname] = ytCh(id), url = cid === "?" ? "" : `https://www.youtube.com/channel/${cid}`;
    bump(chAll, "yt:" + cid, cname, url, "YouTube");
    if (isNew) { plat.new.all.YouTube++; bump(chNew, "yt:" + cid, cname, url, "YouTube");
      const r = ROUTE[route.get(id)] || route.get(id); routes[r] = (routes[r] || 0) + 1; }
  }
  for (const v of curated) {
    const P = PLAT[v.p] || v.p, key = v.p + ":" + v.id, isNew = !!prevCur && !prevCur.has(key);
    plat.total.curated[P] = (plat.total.curated[P] || 0) + 1; if (isNew) plat.new.curated[P] = (plat.new.curated[P] || 0) + 1;
    if (v.p === "yt" && seen.has(v.id)) continue;            // same YouTube video already counted from the feed
    if (seen.has(key)) continue; seen.add(key); if (v.p === "yt") seen.add(v.id);
    plat.total.all[P] = (plat.total.all[P] || 0) + 1;
    const fromMeta = v.p === "yt" && meta[v.id];
    const [cid, cname] = fromMeta ? ytCh(v.id) : [v.ch, v.ch || "(채널 정보 없음)"];
    const curl = fromMeta ? `https://www.youtube.com/channel/${cid}` : v.p === "tt" ? `https://www.tiktok.com/${v.id.split("/video/")[0]}` : "";
    bump(chAll, v.p + ":" + cid, cname, curl, P);
    if (isNew) { plat.new.all[P] = (plat.new.all[P] || 0) + 1; bump(chNew, v.p + ":" + cid, cname, curl, P);
      routes["작품별 공식 영상 (직접 등록)"] = (routes["작품별 공식 영상 (직접 등록)"] || 0) + 1; }
  }
  for (const [vid, acct, c] of TT) {
    if (!CAT[c]) continue;
    const isNew = !!prevKnown && !prevKnown.has("tt:" + vid), url = `https://www.tiktok.com/@${acct}`;
    plat.total.shorts.TikTok++; plat.total.all.TikTok++; bump(chAll, "tt:@" + acct, "@" + acct, url, "TikTok");
    if (isNew) { plat.new.shorts.TikTok++; plat.new.all.TikTok++; bump(chNew, "tt:@" + acct, "@" + acct, url, "TikTok");
      routes["관리자 페이지에서 추가한 틱톡"] = (routes["관리자 페이지에서 추가한 틱톡"] || 0) + 1; }
  }
  const top = (m, n) => [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, n);
  const out = {
    build, generated_at: new Date().toISOString(), new_tracked: dailyPaths.some(p => fs.existsSync(p)), platforms: plat,
    new_routes: Object.entries(routes).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })),
    channels: { total_count: chAll.size, new_count: chNew.size, top: top(chAll, 100), new: top(chNew, 500) },
  };
  fs.writeFileSync("stats/sources.json", JSON.stringify(out));
  fs.writeFileSync("stats/known_curated.txt", curated.map(v => v.p + ":" + v.id).join("\n"));
}
