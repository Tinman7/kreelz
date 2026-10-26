// Japan edition (kreelz.com/jp): Korean content from Japanese official channels — Japanese OTT (Netflix Japan, U-NEXT,
// Lemino, Disney+ Japan, Prime Video Japan, Hulu, KNTV) and the Japan channels of K-pop artists (SEVENTEEN JAPAN,
// TWICE JAPAN, &TEAM ...). These videos are shown only on /jp: their ids are kept in data/jp_only.json.
// usage: YT_API_KEY=... node scripts/japan.mjs jp.json            (nightly)
//        YT_API_KEY=... node scripts/japan.mjs --check            (find the channels and show what would be collected; writes no site data)
import fs from "node:fs"; import zlib from "node:zlib";
import { hasThumb } from "./thumbs.mjs";
import { JP_ACTORS } from "./actors.mjs";
import { JP_ARTISTS } from "./hybe.mjs";
const KEY = process.env.YT_API_KEY; if (!KEY) { console.error("YT_API_KEY missing"); process.exit(1); }
const CHECK = process.argv.includes("--check");
const outPath = process.argv.slice(2).find(a => !a.startsWith("--")) || "jp.json";
const CFG = "scripts/jp_channels.json", VMETA = "data/vmeta.json.gz", ONLY = "data/jp_only.json";
const API = "https://www.googleapis.com/youtube/v3/", DAY = 864e5;
const FIRST = +(process.env.JP_FIRST || 200), DAILY = +(process.env.JP_DAILY || 40);   // videos per channel: first run / later runs
let used = 0;
async function call(ep, params) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(API + ep + "?" + new URLSearchParams({ ...params, key: KEY }));
    const d = await r.json().catch(() => ({}));
    if (!d.error) { used += ep === "search" ? 100 : 1; return d; }
    if (/quota/i.test(JSON.stringify(d.error))) throw new Error("quota");
    if (r.status === 404) return { items: [] };
    await new Promise(s => setTimeout(s, 2000 * (t + 1)));
  }
  return { items: [] };
}
async function playlist(pid, max) {
  const ids = []; let pageToken;
  do {
    const d = await call("playlistItems", { part: "contentDetails", playlistId: pid, maxResults: 50, ...(pageToken ? { pageToken } : {}) });
    (d.items || []).forEach(x => ids.push(x.contentDetails.videoId));
    pageToken = d.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}
const dur = s => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };

// ---- 1) find each channel once (search + name and subscriber check), then remember its id
const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
for (const c of cfg.channels) {
  if (c.id) continue;
  if (c.searched && Date.now() - new Date(c.searched) < 7 * DAY) continue;   // nothing found recently: try again weekly
  let d; try { d = await call("search", { part: "snippet", type: "channel", q: c.q, maxResults: 5 }); }
  catch (e) { console.log("search stopped:", e.message); break; }          // out of quota: collect from the channels already known
  const ids = (d.items || []).map(x => x.snippet.channelId || (x.id || {}).channelId).filter(Boolean);
  if (!ids.length) { console.log("not found:", c.q); continue; }
  const s = await call("channels", { part: "snippet,statistics", id: ids.join(",") });
  const re = new RegExp(c.title, "i");
  const no = c.not ? new RegExp(c.not, "i") : null;
  const hit = (s.items || []).find(x => re.test(x.snippet.title) && !(no && no.test(x.snippet.title)) && +(x.statistics.subscriberCount || 0) >= (c.min || 0));
  console.log("search", JSON.stringify(c.q), "->", (s.items || []).map(x => `${x.snippet.title} (${x.statistics.subscriberCount})`).join(" | "), "=>", hit ? "ACCEPTED " + hit.id : "none accepted");
  if (hit) { c.id = hit.id; c.name = hit.snippet.title; delete c.searched; } else c.searched = new Date().toISOString().slice(0, 10);
}
fs.writeFileSync(CFG, JSON.stringify(cfg, null, 1) + "\n");

// ---- 2) recent uploads and shorts of each channel
const h = fs.readFileSync("index.html", "utf8");
const onSite = new Set(); for (const n of ["SHORTS", "FEED"]) { const s = h.match(new RegExp(`const ${n} = "([^"]*)";`))[1]; for (let i = 0; i + 16 <= s.length; i += 16) onSite.add(s.slice(i, i + 11)); }
const only = new Set(fs.existsSync(ONLY) ? JSON.parse(fs.readFileSync(ONLY, "utf8")) : []);
const chOf = {}, shortIds = new Set();
for (const c of cfg.channels) {
  if (!c.id) continue;
  const max = c.done ? DAILY : FIRST;
  const up = await playlist("UU" + c.id.slice(2), max), sh = await playlist("UUSH" + c.id.slice(2), max);
  up.forEach(id => { chOf[id] = c }); sh.forEach(id => { chOf[id] = c; shortIds.add(id) });
  console.log(c.name || c.q, c.id, "uploads", up.length, "shorts", sh.length);
}
const all = Object.keys(chOf).filter(id => !onSite.has(id));
const vmeta = fs.existsSync(VMETA) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(VMETA))) : {};
const info = {};
for (let i = 0; i < all.length; i += 50) {
  const d = await call("videos", { part: "snippet,statistics,contentDetails,status,topicDetails", id: all.slice(i, i + 50).join(","), maxResults: 50 });
  for (const v of d.items || []) {
    const s = v.snippet || {}, st = v.status || {};
    info[v.id] = { views: +((v.statistics || {}).viewCount ?? -1), days: Math.max(0, Math.floor((Date.now() - new Date(s.publishedAt)) / DAY)),
      usable: st.uploadStatus === "processed" && st.privacyStatus === "public" && st.embeddable !== false && (s.liveBroadcastContent || "none") === "none",
      audio: (s.defaultAudioLanguage || s.defaultLanguage || "").toLowerCase(), desc: s.description || "",
      meta: [s.title || "", s.channelId || "", s.channelTitle || "", s.categoryId || "", ((v.topicDetails || {}).topicCategories || []).map(u => u.split("/").pop()), (s.tags || []).slice(0, 12), dur((v.contentDetails || {}).duration)] };
  }
}

// ---- 3) keep Korean content, decide the category
// Korean: Korean audio, a clear K-content word, Hangul, a Korean name in katakana (パク・ヘス, イ・ヒジュン ...) or a
// Japan-edition actor/artist. A bare 韓国/Korea is not enough ("Summer Camp in Korea" is a J-pop show).
const KWORD = /韓国ドラマ|韓国映画|韓国バラエティ|韓ドラ|韓流|韓国発|韓国の(人気|大ヒット|話題)|k-?pop|k-?ドラマ|kドラマ|k-?drama|korean ?(drama|series|film|movie)|[가-힣]/i;
const KNAME = /(?:^|[^ァ-ヶー])(?:キム|イ|パク|チェ|チョン|チョ|カン|ユン|チャン|イム|ハン|オ|ソ|シン|クォン|ファン|アン|ソン|ホン|ユ|チュ|ナム|ペ|ノ|ハ|ムン|ヤン|コ|ペク|ピョン|ウ|ク|ミン|ジョン|ソル|チ|リュ|チャ|ド|ヨ|ヒョン|オム|キ|チン|ナ|ジン)・[ァ-ヶ]{2,5}(?![ァ-ヶー])/g;   // no ー: キム・カーダシアン is not Korean
// two different Korean names (a cast) — one alone can be a Western name (アン・ハサウェイ)
const cast = t => new Set((t.match(KNAME) || []).map(x => x.replace(/^[^ァ-ヶ]/, ""))).size >= 2;
const SPORT = /ボクシング|格闘|修斗|RIZIN|\bT?KO\b|KO勝|級\d*回戦|試合|プロデビュー|フェニックスバトル|サッカー|野球|ゴルフ|競馬|\bvs\.?\b/i;
const names = [...JP_ACTORS, ...JP_ARTISTS].map(a => a[2]), idols = JP_ARTISTS.map(a => a[2]);
const why = v => { const t = v.meta[0] + " " + v.meta[5].join(" ");
  if (SPORT.test(v.meta[0])) return "";
  return v.audio.startsWith("ko") ? "audio" : KWORD.test(t) ? "word" : cast(t) ? "cast" : names.some(re => re.test(t)) ? "star"
    : KWORD.test(v.desc.slice(0, 400)) && cast(v.desc.slice(0, 600)) ? "desc" : ""; };
const korean = v => !!why(v);
const MUSIC = /MMA ?20\d\d|\bMMA\b|\bMAMA\b|KCON|ミュージックビデオ|\bM\/?V\b|music video|ライブ|\blive\b|コンサート|ツアー|\btour\b|人気歌謡|ミュージックバンク|Mカウントダウン|M ?COUNTDOWN|音楽番組|授賞式|アワード|award|カムバ|comeback|デビュー|debut/i;
const FILM = /映画|劇場|ムービー|\bmovie\b|\bfilm\b|영화/i;
const SHOW = /バラエティ|リアリティ|恋愛リアリティ|サバイバル|オーディション|密着|ドキュメンタリー|インタビュー|interview|ビハインド|behind|メイキング|making|vlog|リアクション|reaction|ゲーム|トーク|出演回|驚きの土曜日|ユ・?クイズ|ランニングマン|知ってるお兄さん|私は一人で暮らす|예능|리얼리티|인터뷰|비하인드/i;
const cat = v => {
  const c = chOf[v.id], text = v.meta[0] + " " + v.meta[5].join(" ");
  if (c.cat === "music") return SHOW.test(text) ? "e" : "m";
  if ((SHOW.test(text) || idols.some(re => re.test(v.meta[0]))) && !/ドラマ/.test(v.meta[0]) && !MUSIC.test(v.meta[0])) return "e";
  if (MUSIC.test(v.meta[0])) return "m";
  if (FILM.test(text)) return "f";
  return "d";
};
const out = { videos: {}, shorts: {} }, per = {}; let skipped = 0, notKorean = 0;
const cand = all.filter(id => info[id] && info[id].usable && info[id].views >= 300);
const good = new Set(), checks = [...cand];
await Promise.all(Array.from({ length: 16 }, async () => { while (checks.length) { const id = checks.pop(); if (await hasThumb(id, shortIds.has(id) ? "s" : "v")) good.add(id); } }));
for (const id of cand) {
  const v = { ...info[id], id }, c = chOf[id];
  if (!good.has(id)) { skipped++; continue; }
  if (c.korean && !korean(v)) { notKorean++; continue; }
  const k = cat(v), p = per[c.name || c.q] = per[c.name || c.q] || { videos: 0, shorts: 0, sample: [] };
  if (shortIds.has(id)) { out.shorts[id] = [k, v.views, 1, v.days]; p.shorts++; } else { out.videos[id] = [k, v.views, v.days, 1]; p.videos++; }
  if (p.sample.length < (CHECK ? 10 : 4)) p.sample.push(`[${k}${c.korean ? " " + why(v) : ""}] ${v.meta[0].slice(0, 70)}`);
  if (!CHECK) { vmeta[id] = v.meta; only.add(id); }
}
const report = Object.entries(per).map(([n, p]) => `${n}: videos ${p.videos}, shorts ${p.shorts}\n   ` + p.sample.join("\n   ")).join("\n");
console.log(report);
if (CHECK) fs.writeFileSync("jp_check.txt", report + "\n");
if (!CHECK) {
  for (const c of cfg.channels) if (c.id) c.done = true;
  fs.writeFileSync(CFG, JSON.stringify(cfg, null, 1) + "\n");
  fs.writeFileSync(VMETA, zlib.gzipSync(JSON.stringify(vmeta)));
  fs.writeFileSync(ONLY, JSON.stringify([...only]));
  fs.writeFileSync(outPath, JSON.stringify(out));
}
const summary = JSON.stringify({ check: CHECK, channels_found: cfg.channels.filter(c => c.id).length, of: cfg.channels.length, new_candidates: all.length,
  videos: Object.keys(out.videos).length, shorts: Object.keys(out.shorts).length, not_korean: notKorean, skipped, quota_used: used });
console.log(summary); if (CHECK) fs.appendFileSync("jp_check.txt", summary + "\n");
