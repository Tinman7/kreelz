// Daytime updates (per David 2026-11-03: "음악방송 무대나 화제 영상은 자정에만 갱신하지 말고 낮에도"): every hour from
// morning to night, the newest uploads of
//   - the music-show and performance channels (KBS Kpop, MBCkpop, SBSKPOP X INKIGAYO, Mnet K-POP, M2, ALL THE K-POP,
//     1theK, dingo, STUDIO CHOOM, it's Live, KBS WORLD TV), the labels (HYBE LABELS, JYP, SMTOWN) and the priority
//     artists' official channels,
//   - the 50 channels whose clips were watched most on KREELZ's lists in the last 7 days (variety, dramas, ...),
// read from YouTube's public channel feeds (RSS: no API quota), are added to live.js — which both editions load at once —
// when they are taking off: uploaded in the last 48 hours with enough views (music-show stages from 15,000, anything else
// from 80,000 or 4,000 an hour). Each new clip is checked with oEmbed (plays in our player) and for shorts / videos;
// Japanese (and English / Spanish for Korean titles) titles by Claude (a few cents a day). Mukbang rules kept.
// Daytime finds stay 3 days in live.js; the nightly refresh finds the same clips by itself.
// usage: [ANTHROPIC_API_KEY=…] node scripts/daytime.mjs live.js [--dry]
import fs from "node:fs";
import zlib from "node:zlib";
import { ARTISTS, JP_ARTISTS, rank, rankIn } from "./hybe.mjs";
import { eatBlocked } from "./noeat.mjs";
import { gate } from "./catgate.mjs";
import { showOk, blocked, isGlobal } from "./showsgate.mjs";   // Shows tab: stars, subtitled channels or nothing (per David 2026-11-27)   // each clip in the tab it belongs to (per David 2026-11-12)

const NEWSY = /폭행|사망|살인|사건|사고|블랙박스|범죄|경찰|숨진|참사|흉기|구속|재판|빚투|마약|음주운전/;
const OUT = process.argv.slice(2).find(a => !a.startsWith("--")) || "live.js", DRY = process.argv.includes("--dry");
const AK = process.env.ANTHROPIC_API_KEY, DAY = 864e5, NOW = Date.now();
const h = fs.readFileSync("index.html", "utf8");
const str = n => (new RegExp(`const ${n} = "([^"]*)"`).exec(h) || [])[1] || "";
const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", dec2 = s => B.indexOf(s[0]) * 64 + B.indexOf(s[1]);
let vmeta = {}; try { vmeta = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch (e) {}

// ---- what is on the site, and each channel's usual category and recent views
const onSite = new Set(), chCat = {}, chViews = {};
for (const name of ["FEED", "SHORTS"]) {
  const s = str(name);
  for (let i = 0; i + 16 <= s.length; i += 16) {
    const id = s.slice(i, i + 11), c = s[i + 11], vc = dec2(s.slice(i + 12, i + 14)), days = dec2(s.slice(i + 14, i + 16));
    onSite.add(id);
    const ch = (vmeta[id] || [])[1]; if (!ch) continue;
    (chCat[ch] ||= {})[c.toLowerCase()] = (chCat[ch][c.toLowerCase()] || 0) + 1;
    if (days <= 7 && vc !== 4095 && c === c.toUpperCase()) chViews[ch] = (chViews[ch] || 0) + Math.pow(1.006, vc);
  }
}
const STAGE = {   // music shows and performance channels: K-pop, lower bar
  "UCeLPm9yH_a_QH8n6445G-Ow": "KBS Kpop", "UCe52oeb7Xv_KaJsEzcKXJJg": "MBCkpop", "UCS_hnpJLQTvBkqALgapi_4g": "SBSKPOP X INKIGAYO",
  "UCbD8EppRX3ZwJSou-TVo90A": "Mnet K-POP", "UCTQVIXvcHrR9jYoJ6qaBAow": "M2", "UCPde4guD9yFBRzkxk2PatoA": "ALL THE K-POP",
  "UCqq-ovGE01ErlXakPihhKDA": "1theK Originals", "UCkt5auxw8j76wvEuH4u-JJg": "1theK Live", "UCweOkPb1wVVH0Q0Tlj4a5Pw": "1theK",
  "UCtCiO5t2voB14CmZKTkIzPQ": "dingo music", "UCEIi7zFR_wE23jFncVtd6-A": "STUDIO CHOOM", "UCB9e3pof1o83aa0kkaoeJGA": "it's Live",
  "UC5BMQOsAB8hKUyHu9KI6yig": "KBS WORLD TV", "UC3IZKseVpdzPSBaWxBxundA": "HYBE LABELS", "UCaO6TYtlC8U5ttz62hTrZgg": "JYP Entertainment",
  "UCEf_Bc-KVd7onSeifS3py9g": "SMTOWN",
};
const chans = new Map(Object.keys(STAGE).map(c => [c, "m"]));
for (const a of [...ARTISTS, ...JP_ARTISTS]) for (const c of a[1]) if (!chans.has(c)) chans.set(c, "m");
const usual = c => { const o = chCat[c] || {}; return Object.keys(o).sort((a, b) => o[b] - o[a])[0] || ""; };
if (!chans.has("UCNIiH_4ArJNd_cDZApZ7AFg")) chans.set("UCNIiH_4ArJNd_cDZApZ7AFg", usual("UCNIiH_4ArJNd_cDZApZ7AFg") || "e");   // TVING (originals, per David 2026-11-03)
for (const c of Object.keys(chViews).sort((a, b) => chViews[b] - chViews[a]).slice(0, 50)) if (!chans.has(c) && usual(c)) chans.set(c, usual(c));

// ---- the channels' newest uploads (RSS)
const old = (() => { try { return JSON.parse(fs.readFileSync(OUT, "utf8").replace(/^window\.LIVE=/, "").replace(/;\s*$/, "")); } catch (e) { return { v: [], s: [] }; } })();
const inLive = new Set([...(old.v || []), ...(old.s || [])].map(x => x[0]));
const ent = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const cand = [];
let feeds = 0, feedFail = 0;
// ILLIT's '체포하겠어' challenge shorts with other idols (per David 2026-11-28: "공식 계정에 올라올 때마다 바로바로 업데이트"):
// every upload of ILLIT's official channels that names the song goes in at once, whatever its views, and is held (see hold below)
const ILLIT_CH = new Set((ARTISTS.find(a => a[0] === "ILLIT") || [, []])[1]), ARREST = /체포하겠어|under.?arrest|逮捕/i;
const arrestIds = new Set();
const list = [...chans.entries()];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (list.length) {
    const [ch, cat] = list.pop();
    try {
      const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch}`, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) { feedFail++; continue; }
      const x = await r.text(); feeds++;
      const chName = ent((x.match(/<author>\s*<name>([^<]*)<\/name>/) || [])[1] || "");
      for (const e of x.split("<entry>").slice(1)) {
        const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1]; if (!id || onSite.has(id) || inLive.has(id)) continue;
        const t = ent((e.match(/<title>([^<]*)<\/title>/) || [])[1] || ""), pub = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || "";
        const views = +((e.match(/<media:statistics views="(\d+)"/) || [])[1] || 0), hrs = Math.max(1, (NOW - Date.parse(pub)) / 36e5);
        if (t && pub && ILLIT_CH.has(ch) && ARREST.test(t) && hrs <= 14 * 24) {
          arrestIds.add(id); cand.push({ id, ch, chName, cat: "m", t, pub, views, rate: Infinity, stage: true }); continue;
        }
        if (!t || !pub || hrs > 48) continue;
        const stage = cat === "m" && (STAGE[ch] || [...ARTISTS, ...JP_ARTISTS].some(a => a[1].includes(ch)));
        if (!(stage ? views >= 15000 : views >= 80000 || views / hrs >= 4000)) continue;
        if (eatBlocked(t, chName, cat)) continue;
        if (NEWSY.test(t)) continue;   // accident / crime / court-case clips are not what fans come for
        // from the busiest channels (not the stage / artist ones): Korean content only — a Korean title or a priority artist
        if (!stage && !/[가-힣]/.test(t) && !rank([t, ch]) && !rankIn(JP_ARTISTS, [t, ch])) continue;
        const cat2 = gate(cat, t, chName, ""); if (!cat2 || (blocked(`${t} ${chName}`) && cat2 !== "d" && cat2 !== "f") || (cat2 === "e" && !showOk(t, chName, ""))) continue;
        cand.push({ id, ch, chName, cat: cat2, t, pub, views, rate: views / hrs, stage });
      }
    } catch (e) { feedFail++; }
  }
}));
cand.sort((a, b) => b.rate - a.rate);
const pick = cand.slice(0, 30);

// ---- plays in our player? short or video?
const okIds = new Set(), shorts = new Set();
await Promise.all(pick.map(async c => {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + c.id)}`, { signal: AbortSignal.timeout(8000) });
    if (r.status !== 200) return;
    okIds.add(c.id);
    const s = await fetch(`https://www.youtube.com/shorts/${c.id}`, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (s.status === 200) shorts.add(c.id);
  } catch (e) {}
}));
const add = pick.filter(c => okIds.has(c.id));

// ---- Korea's trending now (per David 2026-11-27: "그때그때 핫 트렌드를 일본판도 영어판도 맨 앞에", like Naver's 연예 now page):
// YouTube's own trending chart for Korea (videos.list chart=mostPopular, 1 API unit per call, 3 calls an hour), entertainment,
// music, film and comedy only — no news, politics, sports or games, accident / crime clips, mukbang rules kept, each clip in
// its tab (catgate). The top ones go in live.js "trend" (ranked); the app puts up to 6 of them right after the front list
// and pins in each tab, on both editions. Clips not on the site yet are added like the other daytime finds.
const POL = /대통령|국회|국힘|민주당|국민의힘|정당|선거|탄핵|윤석열|이재명|김건희|한동훈|검찰|특검|뉴스|속보|news|시사|정치|북한|전쟁|관세/i;
const TCAT = { "10": "m", "1": "f", "24": "", "23": "e", "22": "" };
let trend = old.trend || null;
if (process.env.YT_API_KEY) {
  const seen = new Map(); let calls = 0;
  for (const vc of ["", "10", "24", "1", "23"]) {
    try {
      const r = await (await fetch("https://www.googleapis.com/youtube/v3/videos?" + new URLSearchParams({ part: "snippet,statistics,contentDetails", chart: "mostPopular", regionCode: "KR", maxResults: "50", ...(vc ? { videoCategoryId: vc } : {}), key: process.env.YT_API_KEY }), { signal: AbortSignal.timeout(15000) })).json();
      calls++; (r.items || []).forEach((v, k) => { const o = seen.get(v.id); if (!o || k < o.k) seen.set(v.id, { v, k }); });
    } catch (e) {}
  }
  const T = [];
  for (const { v, k } of [...seen.values()].sort((a, b) => a.k - b.k)) {
    const sn = v.snippet || {}, t = sn.title || "", chName = sn.channelTitle || "", ch = sn.channelId || "", vc = sn.categoryId || "";
    if (!(vc in TCAT) || NEWSY.test(t) || POL.test(t) || POL.test(chName) || !sn.publishedAt) continue;
    // K-content the site already carries: a channel whose clips are on KREELZ, or a priority artist (not just any Korean-language upload)
    if (!usual(ch) && !rank([t, ch]) && !rankIn(JP_ARTISTS, [t, ch])) continue;
    const base = usual(ch) || TCAT[vc] || "e"; if (eatBlocked(t, chName, base)) continue;
    const cat = gate(base, t, chName, sn.tags || ""); if (!cat || blocked(`${t} ${chName}`) || (cat === "e" && !showOk(t, chName, sn.tags))) continue;
    T.push({ id: v.id, ch, chName, cat, t, pub: sn.publishedAt, views: +(v.statistics || {}).viewCount || 0, k });
    if (T.length >= 24) break;
  }
  const tOk = new Set(), tShort = new Set();
  await Promise.all(T.map(async c => { try {
    if (onSite.has(c.id) || inLive.has(c.id)) { tOk.add(c.id); return; }
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + c.id)}`, { signal: AbortSignal.timeout(8000) });
    if (r.status !== 200) return; tOk.add(c.id);
    const s = await fetch(`https://www.youtube.com/shorts/${c.id}`, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (s.status === 200) tShort.add(c.id);
  } catch (e) {} }));
  const T2 = T.filter(c => tOk.has(c.id));
  for (const c of T2) if (!onSite.has(c.id) && !inLive.has(c.id) && !add.some(x => x.id === c.id)) { add.push(c); if (tShort.has(c.id)) shorts.add(c.id); }
  if (calls) trend = { at: new Date().toISOString(), ids: T2.map(c => c.id) };
  console.log(`trend: ${calls} chart calls, ${seen.size} trending, ${T2.length} kept:`, T2.slice(0, 8).map(c => `${c.cat} ${c.t.slice(0, 40)}`).join(" / "));
}

// ---- X (Twitter) trends in Korea → the clips on YouTube (per David 2026-11-27: "X에서 파악한 다음에 그 영상들을 유튜브에서 찾아서",
// paid X API approved by David, about $5 a month). Every hour: Korea's X trends (official API, X_BEARER secret; trends only, no
// posts read or written), the ones about what KREELZ carries (a priority artist, or a word found in 3+ clip titles on the site;
// no news, politics or incidents), each new one searched once on YouTube (uploads of the last 48 hours, Korean, most viewed;
// at most 2 a run and 15 a day = 1,500 of the 10,000 daily units). Up to 3 clips per trend lead live.js "trend" for 24 hours.
let XCFG = { posts: false }; try { XCFG = JSON.parse(fs.readFileSync("scripts/xtrend.json", "utf8")); } catch (e) {}
const xtexts = {}, xgot = {};   // per new trend: its top posts (text) and the clips found
let xstate = old.xtr || { seen: {}, day: "", n: 0, picks: [] };
if (process.env.YT_API_KEY) {   // X trends when X_BEARER is set, otherwise Google Trends Korea (free RSS) — per David 2026-11-27, X flagged his accounts
  const today = new Date(NOW + 9 * 3600e3).toISOString().slice(0, 10);
  if (xstate.day !== today) { xstate.day = today; xstate.n = 0; }
  for (const k of Object.keys(xstate.seen)) if (NOW - xstate.seen[k] > 3 * DAY) delete xstate.seen[k];
  xstate.picks = (xstate.picks || []).filter(p => NOW - p.at < DAY);
  let xt = [];
  if (process.env.X_BEARER) try {
    const r = await fetch("https://api.x.com/2/trends/by/woeid/23424868?max_trends=30", { headers: { Authorization: `Bearer ${process.env.X_BEARER}` }, signal: AbortSignal.timeout(15000) });
    const j = await r.json(); xt = (j.data || []).map(x => String(x.trend_name || "").trim()).filter(Boolean);
    if (!r.ok) console.log("x trends:", r.status, JSON.stringify(j).slice(0, 200));
  } catch (e) { console.log("x trends failed:", e.message); }
  // Google Trends: what Korea is searching right now (public RSS, no key, no cost) — each with the news headlines behind it,
  // which feed the one-line "why it's trending" the same way X posts do
  if (!xt.length) try {
    const x = await (await fetch("https://trends.google.com/trending/rss?geo=KR", { signal: AbortSignal.timeout(15000) })).text();
    for (const it of x.split("<item>").slice(1)) {
      const tt = ((/<title>([\s\S]*?)<\/title>/.exec(it) || [])[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim(); if (!tt) continue;
      xt.push(tt); xtexts[tt] = [...it.matchAll(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/g)].map(m => m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()).slice(0, 4);
    }
    console.log(`google trends: ${xt.length} in Korea`);
  } catch (e) { console.log("google trends failed:", e.message); }
  const titles = Object.values(vmeta).map(m => (m && m[0]) || "");
  const onSiteN = w => { if (w.length < 2) return 0; let n = 0; for (const t of titles) if (t.includes(w) && ++n >= 50) break; return n; };
  // K-content first: a priority artist or a music show / awards / drama word, then words that are common in the site's titles
  const KWORD = /뮤뱅|뮤직뱅크|음방|인가|엠카|쇼챔|음악중심|1위|컴백|comeback|\bmv\b|뮤비|teaser|티저|직캠|챌린지|드라마|예능|시상식|어워즈|awards|팬미팅|콘서트|아이돌/i;
  const AD = /^#?[^\s]*(?:쁘아|뷰티|코스메틱|화장품|이벤트|할인|세일|증정)$/;
  const rel = xt.map(n => { const w = n.replace(/^#/, "").replace(/_/g, " ").trim();
    if (!w || POL.test(w) || NEWSY.test(w) || AD.test(n)) return null;
    const sc = (rank([w, ""]) || rankIn(JP_ARTISTS, [w, ""]) ? 100 : 0) + (KWORD.test(w) ? 50 : 0) + Math.min(onSiteN(w), 50);
    return sc >= 50 || onSiteN(w) >= 10 ? { n, sc } : null; }).filter(Boolean).sort((a, b) => b.sc - a.sc).map(x => x.n);
  const fresh = rel.filter(n => !xstate.seen[n]).slice(0, Math.max(0, Math.min(2, 15 - xstate.n)));
  console.log(`x trends: ${xt.length} in Korea, ${rel.length} about K-content (${rel.slice(0, 10).join(", ")}), searching ${fresh.join(", ") || "none"}`);
  for (const n of fresh) {
    xstate.seen[n] = NOW; xstate.n++;
    let q = n.replace(/^#/, "").replace(/_/g, " ");
    // the default rule: the most liked / retweeted video posts on the trend give the YouTube keywords (their hashtags)
    if (XCFG.posts && process.env.X_BEARER) try {
      const xr = await (await fetch("https://api.x.com/2/tweets/search/recent?" + new URLSearchParams({ query: `${n.startsWith("#") ? n : `"${q}"`} has:videos -is:retweet -is:reply`, max_results: String(Math.max(10, Math.min(100, XCFG.per_trend || 10))), sort_order: "relevancy", "tweet.fields": "public_metrics,entities,lang" }), { headers: { Authorization: `Bearer ${process.env.X_BEARER}` }, signal: AbortSignal.timeout(15000) })).json();
      if (xr.errors || xr.status || xr.title) console.log(`  [${n}] x posts error:`, JSON.stringify(xr).slice(0, 200));
      const top = (xr.data || []).map(p => ({ p, sc: ((p.public_metrics || {}).like_count || 0) + 2 * ((p.public_metrics || {}).retweet_count || 0) })).sort((a, b) => b.sc - a.sc).slice(0, 3);
      const tags = {}; for (const { p, sc } of top) for (const h of ((p.entities || {}).hashtags || [])) { const t = h.tag.replace(/_/g, " "); if (t && !q.includes(t) && !POL.test(t)) tags[t] = (tags[t] || 0) + sc + 1; }
      const extra = Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 2);
      if (extra.length) q = `${q} ${extra.join(" ")}`;
      xtexts[n] = top.map(t => String(t.p.text || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 240)).filter(Boolean);
      console.log(`  [${n}] x posts: ${(xr.data || []).length}, top ${top.map(t => t.sc).join("/")} → "${q}"`);
    } catch (e) { console.log(`  [${n}] x posts failed:`, e.message); }
    try {
      const sr = await (await fetch("https://www.googleapis.com/youtube/v3/search?" + new URLSearchParams({ part: "id", type: "video", q, order: "viewCount", regionCode: "KR", relevanceLanguage: "ko", maxResults: "15", publishedAfter: new Date(NOW - 2 * DAY).toISOString(), key: process.env.YT_API_KEY }), { signal: AbortSignal.timeout(15000) })).json();
      const ids = (sr.items || []).map(x => x.id && x.id.videoId).filter(Boolean); if (!ids.length) { console.log(`  [${n}] nothing`, sr.error ? sr.error.message : ""); continue; }
      const vr = await (await fetch("https://www.googleapis.com/youtube/v3/videos?" + new URLSearchParams({ part: "snippet,statistics", id: ids.join(","), key: process.env.YT_API_KEY }), { signal: AbortSignal.timeout(15000) })).json();
      const got = [];
      for (const v of vr.items || []) {
        const sn = v.snippet || {}, t = sn.title || "", chName = sn.channelTitle || "", ch = sn.channelId || "", vc = sn.categoryId || "";
        const views = +(v.statistics || {}).viewCount || 0;
        if (views < 20000 || NEWSY.test(t) || POL.test(t) || POL.test(chName) || ["25", "17", "20"].includes(vc)) continue;
        if (!/[가-힣]/.test(t) && !rank([t, ch]) && !rankIn(JP_ARTISTS, [t, ch])) continue;
        const base = usual(ch) || TCAT[vc] || "e"; if (eatBlocked(t, chName, base)) continue;
        const cat = gate(base, t, chName, sn.tags || ""); if (!cat || blocked(`${t} ${chName}`) || (cat === "e" && !showOk(t, chName, sn.tags))) continue;
        let ok = onSite.has(v.id) || inLive.has(v.id), short = false;
        if (!ok) try {
          ok = (await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + v.id)}`, { signal: AbortSignal.timeout(8000) })).status === 200;
          if (ok) short = (await fetch(`https://www.youtube.com/shorts/${v.id}`, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000) })).status === 200;
        } catch (e) { ok = false; }
        if (!ok) continue;
        const c = { id: v.id, ch, chName, cat, t, pub: sn.publishedAt, views };
        if (!onSite.has(c.id) && !inLive.has(c.id) && !add.some(x => x.id === c.id)) { add.push(c); if (short) shorts.add(c.id); }
        got.push(c); if (got.length >= 3) break;
      }
      for (const c of got) xstate.picks.unshift({ id: c.id, at: NOW, kw: n });
      if (got.length) xgot[n] = got;
      console.log(`  [${n}] ${got.length} clips:`, got.map(c => `${c.cat} ${c.views} ${c.t.slice(0, 40)}`).join(" / "));
    } catch (e) { console.log(`  [${n}] failed:`, e.message); }
  }
}
// one line on why it's trending, per new trend, in Japanese / English / Spanish (Claude; a few cents a day) → live.js "ctx" by clip
const ctx = Object.fromEntries(Object.entries(old.ctx || {}).filter(([, c]) => c && NOW - (c.at || 0) < 36 * 3600e3));
if (AK && Object.keys(xgot).length) try {
  const input = Object.fromEntries(Object.entries(xgot).map(([n, got]) => [n, { trend: n, top_posts: xtexts[n] || [], clip_titles: got.map(c => c.t) }]));
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
    headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 3000, thinking: { type: "disabled" },
      system: `You write one short line telling international K-content fans why something is trending in Korea right now. For each key you get a trend in Korea (from X or Google Trends), the text of its most liked X posts or the news headlines behind it (top_posts), and the titles of YouTube clips about it.
Write what happened and why Koreans are reacting, in your own words (never copy a post), as plain facts from the material only: no guessing, no rumours, no opinions, no hype words, no hashtags, no emojis. Name people the way fans abroad know them. At most 90 characters each. Never write Korean script (Hangul) — romanize names in "en"/"es", katakana in "ja".
Give it in Japanese ("ja", natural for Japanese fans, Korean names in katakana with a middle dot), English ("en") and Latin American Spanish ("es").
Also a short story of 3-4 sentences (at most 320 characters) for fans who tap for more: who, what happened, how Korean viewers reacted, why it's fun — same rules, facts from the material only — as "sja", "sen", "ses".
If the material does not show what happened, use "" for everything.
Output ONLY JSON: {"<key>": {"ja": "...", "en": "...", "es": "...", "sja": "...", "sen": "...", "ses": "..."}, ...}`,
      messages: [{ role: "user", content: JSON.stringify(input) }] }) });
  const d = await r.json(); const t = (d.content || []).map(c => c.text || "").join("");
  const o = r.ok ? JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)) : {};
  for (const [n, got] of Object.entries(xgot)) { const c = o[n]; if (!c || !(c.ja || c.en)) continue;
    const cut = (x, k) => String(x || "").slice(0, k);
    for (const g of got) ctx[g.id] = { ja: cut(c.ja, 120), en: cut(c.en, 120), es: cut(c.es, 120), sja: cut(c.sja, 400), sen: cut(c.sen, 400), ses: cut(c.ses, 400), kw: n, at: NOW };
    console.log(`  ctx [${n}] ${c.en}`); }
} catch (e) { console.log("ctx skipped:", e.message); }
if (xstate.picks && xstate.picks.length) {
  const xi = [...new Set(xstate.picks.map(p => p.id))];
  trend = { at: (trend && trend.at) || new Date().toISOString(), ids: [...new Set([...xi, ...((trend && trend.ids) || [])])] };
}

// ---- titles: Japanese for every new clip, English and Spanish for Korean ones (live.js keeps them by title)
const tx = { ja: { ...(old.ja || {}) }, en: { ...(old.en || {}) }, es: { ...(old.es || {}) } };
async function claude(system, titles) {
  if (!AK || !titles.length) return {};
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 6000, system, thinking: { type: "disabled" },
        messages: [{ role: "user", content: JSON.stringify(Object.fromEntries(titles.map((t, i) => [String(i), t]))) }] }) });
    const d = await r.json(); if (!r.ok) { console.log("Claude", r.status); return {}; }
    const s = (d.content || []).map(c => c.text || "").join(""); const o = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));
    return Object.fromEntries(titles.map((t, i) => [t, typeof o[String(i)] === "string" ? o[String(i)].trim() : ""]).filter(e => e[1] && e[1] !== e[0]));
  } catch (e) { console.log("translation skipped:", e.message); return {}; }
}
// the same instructions as the nightly translations (scripts/titles.mjs)
const SYSTEM_JA = `You translate titles of Korean entertainment videos (K-pop, K-drama, film, variety shows, beauty, food, travel) into natural Japanese for Japanese fans.
Rules:
- Use the names Japanese fans use: Korean people in katakana with a middle dot between family and given name (차은우 → チャ・ウヌ, 변우석 → ビョン・ウソク); groups and brands in their usual Latin form (BTS, IVE, SEVENTEEN, Olive Young); dramas, films and shows by their official Japanese title when one is widely used (나 혼자 산다 → 私は一人で暮らす, 런닝맨 → ランニングマン), otherwise a natural Japanese rendering.
- Keep emojis, #hashtags, numbers, episode markers like [EP.12] and the punctuation style. A title already in Japanese stays as it is.
- Do not add explanations, quotes or extra words. Keep it about as long as the original.
- Output ONLY a JSON object: {"<key>": "<Japanese title>", ...} with exactly the keys you were given.`;
const SYSTEM_EN = `You translate titles of Korean entertainment videos (K-pop, K-drama, film, variety shows, beauty, food) into natural English for international fans.
Rules:
- Keep names of people, groups, shows, films, channels and brands in their usual official romanized/English form (e.g. 나 혼자 산다 → I Live Alone, 런닝맨 → Running Man, 아이브 → IVE, 변우석 → Byeon Woo-seok). Never translate a name literally.
- Keep emojis, #hashtags, numbers, episode markers like [EP.12] and the punctuation style. Parts already in English stay as they are.
- Do not add explanations, quotes or extra words. Keep it about as long as the original.
- Output ONLY a JSON object: {"<key>": "<English title>", ...} with exactly the keys you were given.`;
const SYSTEM_ES = `You translate titles of Korean entertainment videos (K-pop, K-drama, film, variety shows, beauty, food) into natural, neutral Latin American Spanish for fans in Mexico, Argentina, Chile, Peru and Colombia.
Rules:
- Keep names of people, groups, shows, films, channels and brands in their usual official romanized/English form (e.g. 런닝맨 → Running Man, 아이브 → IVE, 변우석 → Byeon Woo-seok). Never translate a name literally.
- Keep emojis, #hashtags, numbers, episode markers like [EP.12] and the punctuation style. Text already in Spanish stays as it is.
- Do not add explanations, quotes or extra words. Keep it about as long as the original.
- Output ONLY a JSON object: {"<key>": "<Spanish title>", ...} with exactly the keys you were given.`;
// new finds, and earlier daytime finds still without a good translation (a Japanese "translation" left in Korean is redone)
for (const x of [...(old.v || []), ...(old.s || [])]) if (x[10] === 1 && tx.ja[x[6]] && /[가-힣]/.test(tx.ja[x[6]])) delete tx.ja[x[6]];
// every title in live.js, not only the daytime finds: nothing stays in Korean on the English / Japanese pages (per David 2026-11-28)
const daytimeTitles = [...add.map(c => c.t), ...[...(old.v || []), ...(old.s || [])].map(x => x[6])];
const need = l => [...new Set(daytimeTitles.filter(t => !tx[l][t] && (l === "ja" ? !/[ぁ-んァ-ヶ]/.test(t) : /[가-힣]/.test(t))))];
if (!DRY) {
  Object.assign(tx.ja, await claude(SYSTEM_JA, need("ja")));
  Object.assign(tx.en, await claude(SYSTEM_EN, need("en")));
  Object.assign(tx.es, await claude(SYSTEM_ES, need("es")));
}

// ---- live.js: [id, cat, views, upload day, rank (global), rank (/jp), title, channel, short, jp only, daytime]
const kstDay = iso => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);
const keep = new Map([...(old.v || []), ...(old.s || [])].map(x => [x[0], x]));
for (const c of add) keep.set(c.id, [c.id, c.cat, c.views, kstDay(c.pub), rank([c.t, c.ch]) || 0, rankIn(JP_ARTISTS, [c.t, c.ch]) || 0, c.t.slice(0, 150), c.chName, shorts.has(c.id) ? 1 : 0, 0, 1]);
// hold (per David 2026-11-11): clips he asks for that were uploaded long ago stay in live.js until hold.until
const TRENDSET = new Set((trend && trend.ids) || []);   // trending clips stay while they trend, whatever their upload day
const HOLD = new Set(old.hold && old.hold.until >= kstDay(new Date().toISOString()) ? old.hold.ids || [] : []);
const arrestNew = add.filter(c => arrestIds.has(c.id)).map(c => c.id);
let hold = old.hold;
if (arrestNew.length) {   // new '체포하겠어' challenge shorts stay at least 30 days
  const until30 = kstDay(new Date(NOW + 30 * DAY).toISOString());
  const base = HOLD.size ? old.hold : { until: until30, ids: [] };
  hold = { until: base.until > until30 ? base.until : until30, ids: [...new Set([...(base.ids || []), ...arrestNew])] };
  for (const id of arrestNew) HOLD.add(id);
  console.log("체포하겠어 challenge (ILLIT official):", arrestNew.join(", "));
}
const all = [...keep.values()].filter(x => !onSite.has(x[0]) || x[10] !== 1)   // daytime finds the nightly took in are no longer needed here
  .filter(x => HOLD.has(x[0]) || TRENDSET.has(x[0]) || Date.now() - Date.parse(x[3]) < (x[10] === 1 ? 3 : 14) * DAY && !(x[10] === 1 && NEWSY.test(x[6])));
const titles = new Set(all.map(x => x[6]));
const trim = o => Object.fromEntries(Object.entries(o).filter(([k]) => titles.has(k)));
const L = { ...old, ...(hold ? { hold } : {}), ...(trend ? { trend } : {}), xtr: xstate, ctx, klocal: [...(old.v || []), ...(old.s || []), ...add.map(c => [c.id, c.cat, 0, 0, 0, 0, c.t, c.chName])].filter(x => x[1] === "m" && !isGlobal(`${x[6]} ${x[7]}`)).map(x => x[0]), built: new Date().toISOString(), v: all.filter(x => !x[8]), s: all.filter(x => x[8]), ja: trim(tx.ja), en: trim(tx.en), es: trim(tx.es) };
if (!DRY) fs.writeFileSync(OUT, "window.LIVE=" + JSON.stringify(L) + ";\n");
console.log(add.slice(0, 15).map(c => `  ${c.stage ? "stage" : c.cat} ${shorts.has(c.id) ? "short" : "video"} ${c.views} (${Math.round(c.rate)}/h) ${c.chName}: ${c.t.slice(0, 70)}`).join("\n"));
console.log(JSON.stringify({ channels: chans.size, feeds, feed_failed: feedFail, taking_off: cand.length, added: DRY ? 0 : add.length, would_add: add.length, shorts: add.filter(c => shorts.has(c.id)).length }));
