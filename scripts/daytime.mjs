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
for (const c of Object.keys(chViews).sort((a, b) => chViews[b] - chViews[a]).slice(0, 50)) if (!chans.has(c) && usual(c)) chans.set(c, usual(c));

// ---- the channels' newest uploads (RSS)
const old = (() => { try { return JSON.parse(fs.readFileSync(OUT, "utf8").replace(/^window\.LIVE=/, "").replace(/;\s*$/, "")); } catch (e) { return { v: [], s: [] }; } })();
const inLive = new Set([...(old.v || []), ...(old.s || [])].map(x => x[0]));
const ent = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const cand = [];
let feeds = 0, feedFail = 0;
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
        if (!t || !pub || hrs > 48) continue;
        const stage = cat === "m" && (STAGE[ch] || [...ARTISTS, ...JP_ARTISTS].some(a => a[1].includes(ch)));
        if (!(stage ? views >= 15000 : views >= 80000 || views / hrs >= 4000)) continue;
        if (eatBlocked(t, chName, cat)) continue;
        if (NEWSY.test(t)) continue;   // accident / crime / court-case clips are not what fans come for
        // from the busiest channels (not the stage / artist ones): Korean content only — a Korean title or a priority artist
        if (!stage && !/[가-힣]/.test(t) && !rank([t, ch]) && !rankIn(JP_ARTISTS, [t, ch])) continue;
        cand.push({ id, ch, chName, cat, t, pub, views, rate: views / hrs, stage });
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
const daytimeTitles = [...add.map(c => c.t), ...[...(old.v || []), ...(old.s || [])].filter(x => x[10] === 1).map(x => x[6])];
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
const all = [...keep.values()].filter(x => !onSite.has(x[0]) || x[10] !== 1)   // daytime finds the nightly took in are no longer needed here
  .filter(x => Date.now() - Date.parse(x[3]) < (x[10] === 1 ? 3 : 14) * DAY);
const titles = new Set(all.map(x => x[6]));
const trim = o => Object.fromEntries(Object.entries(o).filter(([k]) => titles.has(k)));
const L = { ...old, built: new Date().toISOString(), v: all.filter(x => !x[8]), s: all.filter(x => x[8]), ja: trim(tx.ja), en: trim(tx.en), es: trim(tx.es) };
if (!DRY) fs.writeFileSync(OUT, "window.LIVE=" + JSON.stringify(L) + ";\n");
console.log(add.slice(0, 15).map(c => `  ${c.stage ? "stage" : c.cat} ${shorts.has(c.id) ? "short" : "video"} ${c.views} (${Math.round(c.rate)}/h) ${c.chName}: ${c.t.slice(0, 70)}`).join("\n"));
console.log(JSON.stringify({ channels: chans.size, feeds, feed_failed: feedFail, taking_off: cand.length, added: DRY ? 0 : add.length, would_add: add.length, shorts: add.filter(c => shorts.has(c.id)).length }));
