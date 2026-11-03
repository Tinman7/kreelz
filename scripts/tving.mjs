// TVING Originals (per David 2026-11-03): the TVING app is Korea-only, so clips of its originals are what fans abroad
// can't easily get. Two steps in the nightly refresh:
//   node scripts/tving.mjs collect   — reads the TVING channel's uploads (playlistItems + videos.list: 1 API unit per 50),
//       finds the videos that say they are a TVING Original (title or description: 티빙 오리지널 / TVING ORIGINAL / 티빙오리지널),
//       and learns the shows' names from their hashtags (a name seen on 2+ original videos). Output: data/tving.json
//   node scripts/tving.mjs apply index.html — every clip on the site (any channel) that is one of those videos, says
//       "티빙 오리지널" in its title, or names one of the learned shows → const PRIO_TVO in index.html (the app: badge,
//       where-to-watch line, 2 of the first 12 places in the Screen and Shows tabs).
import fs from "node:fs";
import zlib from "node:zlib";

const MODE = process.argv[2], CH = "UCNIiH_4ArJNd_cDZApZ7AFg", MAX = +(process.env.TVING_MAX || 2000);
const ORIG = /티빙 ?오리지널|TVING ?ORIGINALS?|티빙오리지널|오직 ?티빙/i;
const GENERIC = /^(티빙|tving|티빙오리지널|tvingoriginals?|오리지널|original|shorts?|쇼츠|숏츠|예능|드라마|티빙예능|티빙드라마|예고|티저|하이라이트|선공개|메이킹|비하인드|스페셜|무료|공개|kdrama|kvariety|kpop|tvn|jtbc|mnet|cjenm|스트리밍|신작|오늘|금요일|토요일|일요일|월요일|화요일|수요일|목요일|매주|첫방송|본방사수|티빙에서|최초공개|\d+회|ep\d+)$/i;
const norm = s => s.toLowerCase().replace(/[\s·・_\-'’"“”!?.,:]/g, "");

if (MODE === "collect") {
  const KEY = process.env.YT_API_KEY; if (!KEY) { console.log("tving: no YT_API_KEY"); process.exit(0); }
  const API = "https://www.googleapis.com/youtube/v3/"; let units = 0;
  const call = async (ep, p) => { const r = await fetch(API + ep + "?" + new URLSearchParams({ ...p, key: KEY })); const d = await r.json().catch(() => ({}));
    if (d.error) { if (/quota/i.test(JSON.stringify(d.error))) throw new Error("quota"); return { items: [] }; } units++; return d; };
  const ids = []; let tok;
  try {
    do { const d = await call("playlistItems", { part: "contentDetails", playlistId: "UU" + CH.slice(2), maxResults: 50, ...(tok ? { pageToken: tok } : {}) });
      for (const x of d.items || []) ids.push(x.contentDetails.videoId); tok = d.nextPageToken; } while (tok && ids.length < MAX);
    const orig = [], tags = {};
    for (let i = 0; i < ids.length; i += 50) {
      const d = await call("videos", { part: "snippet", id: ids.slice(i, i + 50).join(","), maxResults: 50 });
      for (const v of d.items || []) {
        const t = v.snippet.title || "", desc = v.snippet.description || "";
        if (!ORIG.test(t + "\n" + desc)) continue;
        orig.push(v.id);
        const seen = new Set();
        for (const m of (t + " " + desc.slice(0, 600)).matchAll(/#([^\s#|,]{2,30})/g)) {
          const n = m[1].replace(/[_]+/g, " ").trim(); if (GENERIC.test(norm(n)) || !/[가-힣]{2}|[A-Za-z]{4}/.test(n) || /^\d/.test(n)) continue;
          if (!seen.has(norm(n))) { seen.add(norm(n)); tags[n] = (tags[n] || 0) + 1; } }
      }
    }
    const shows = Object.fromEntries(Object.entries(tags).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 80));
    fs.writeFileSync("data/tving.json", JSON.stringify({ updated: new Date().toISOString(), uploads: ids.length, originals: orig, shows }, null, 1) + "\n");
    console.log(JSON.stringify({ uploads: ids.length, originals: orig.length, shows: Object.keys(shows).slice(0, 25), units }));
  } catch (e) { console.log("tving collect stopped:", e.message); }
} else if (MODE === "apply") {
  const site = process.argv[3] || "index.html";
  let T = { originals: [], shows: {} }; try { T = JSON.parse(fs.readFileSync("data/tving.json", "utf8")); } catch (e) {}
  let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch (e) {}
  const S = {}, B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const sh = id => ((B.indexOf(id[0]) * 64 + B.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
  const orig0 = id => { const k = sh(id); if (!(k in S)) { try { S[k] = JSON.parse(fs.readFileSync(`t/o/${k}.json`, "utf8")); } catch (e) { S[k] = {}; } } return (S[k][id] || [])[0] || ""; };
  // show names only: 5+ letters (Korean personal names are 3, and short tags like 야구 / 연프 / 용호상박 are everywhere)
const ON = new Set(T.originals || []), NAMES = Object.entries(T.shows || {}).filter(([, c]) => c >= 3).map(([n]) => norm(n))
  .filter(n => (/[가-힣]/.test(n) ? n.length >= 5 : n.length >= 6) && !GENERIC.test(n) && !/^kbo|리그$|야구/.test(n));
  let h = fs.readFileSync(site, "utf8");
  const str = n => (new RegExp(`const ${n} = "([^"]*)"`).exec(h) || [])[1] || "";
  const out = [];
  for (const name of ["FEED", "SHORTS"]) {
    const s = str(name);
    for (let i = 0; i + 16 <= s.length; i += 16) {
      const id = s.slice(i, i + 11), c = s[i + 11].toLowerCase(); if (!"dfe".includes(c)) continue;   // Screen and Shows only
      const t = orig0(id) || (vm[id] || [])[0] || "", nt = norm(t);
      if (ON.has(id) || ORIG.test(t) || NAMES.some(n => nt.includes(n))) out.push(id);
    }
  }
  const ids = [...new Set(out)];
  if (!/const PRIO_TVO = "[^"]*";/.test(h)) { console.log("tving: no PRIO_TVO in", site); process.exit(0); }
  h = h.replace(/const PRIO_TVO = "[^"]*";/, `const PRIO_TVO = "${ids.join("")}";`);
  fs.writeFileSync(site, h);
  console.log(`PRIO_TVO: ${ids.length} clips (${[...ON].filter(id => ids.includes(id)).length} from the TVING channel's original list, ${NAMES.length} show names)`);
} else console.log("usage: node scripts/tving.mjs collect | apply index.html");
