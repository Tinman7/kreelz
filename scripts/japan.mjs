// Japan edition (kreelz.com/jp): Korean content from Japanese official channels — Japanese OTT (Netflix Japan, U-NEXT,
// Lemino, Disney+ Japan, Prime Video Japan, Hulu, KNTV) and the Japan channels of K-pop artists (SEVENTEEN JAPAN,
// TWICE JAPAN, &TEAM ...). These videos are shown only on /jp: their ids are kept in data/jp_only.json.
// usage: YT_API_KEY=... node scripts/japan.mjs jp.json            (nightly)
//        YT_API_KEY=... node scripts/japan.mjs --check            (find the channels and show what would be collected; writes no site data)
import fs from "node:fs"; import zlib from "node:zlib";
import { hasThumb } from "./thumbs.mjs";
import { JP_ACTORS, JP_ACTOR_JA, jpActorKind } from "./actors.mjs";
import { JP_ARTISTS } from "./hybe.mjs";
const KEY = process.env.YT_API_KEY; if (!KEY) { console.error("YT_API_KEY missing"); process.exit(1); }
const CHECK = process.argv.includes("--check");
// JP_TOP_ONLY=1: only the top picked creators (jp_channels.json "top": 성시경의 먹을텐데, 최자로드) — no searches, other channels untouched
const TOP_ONLY = process.env.JP_TOP_ONLY === "1";
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
    if (r.status === 404 || r.status === 403) return { items: [] };   // deleted, or comments turned off
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
  if (c.id || (TOP_ONLY && !c.top)) continue;
  if (c.handle || c.video) {   // exact: by @handle, or by one of the channel's videos
    try {
      const d = c.handle ? await call("channels", { part: "snippet", forHandle: c.handle }) : await call("videos", { part: "snippet", id: c.video });
      const it = (d.items || [])[0];
      if (it) { c.id = c.handle ? it.id : it.snippet.channelId; c.name = c.handle ? it.snippet.title : it.snippet.channelTitle; console.log("found", c.handle || c.video, "->", c.name, c.id); }
      else console.log("not found:", c.handle || c.video);
    } catch (e) { console.log("lookup stopped:", e.message); }
    continue;
  }
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
const RECO_F = "data/jp_reco.json", reco = new Set(fs.existsSync(RECO_F) ? JSON.parse(fs.readFileSync(RECO_F, "utf8")) : []);
const chOf = {}, shortIds = new Set();
for (const c of cfg.channels) {
  if (!c.id || (TOP_ONLY && !c.top)) continue;
  const max = c.done ? DAILY : (c.first || FIRST);
  const up = await playlist("UU" + c.id.slice(2), max), sh = await playlist("UUSH" + c.id.slice(2), max);
  up.forEach(id => { chOf[id] = c }); sh.forEach(id => { chOf[id] = c; shortIds.add(id) });
  const pl = c.playlist ? await playlist(c.playlist, 500) : []; pl.forEach(id => { if (!chOf[id]) chOf[id] = c });
  console.log(c.name || c.q, c.id, "uploads", up.length, "shorts", sh.length, c.playlist ? "playlist " + pl.length : "");
}
// K-Travel & Food (kreelz.com/jp only): Japanese videos about trips, cafes, street food and markets in Korea
// Search groups (kreelz.com/jp only), each a few searches a night in rotation:
//   travel — K-Travel & Food tab: Japanese videos about trips, cafes, street food and markets in Korea
//   beauty — Beauty tab: Olive Young shopping and Korean cosmetics, as Japanese fans watch them
const TR = cfg.travel || { queries: [] }, TRAVEL = { name: "Japanese travel & food videos (search)", cat: "travel", search: true };
const BE = cfg.beauty || { queries: [] }, BEAUTY = { name: "Olive Young / Korean cosmetics (search)", cat: "beauty", search: true };
async function searchGroup(G, tag, days, limit = Infinity) {
  const L = G.queries || []; if (!L.length || limit <= 0 || TOP_ONLY) return 0;
  const n = Math.min(CHECK ? 2 : G.done ? (G.per_night || 2) : (G.first_run || L.length), L.length, limit);
  G.ran = true;
  const start = G.done ? Math.floor(Date.now() / DAY) * n % L.length : 0;   // the first night takes the top of the list
  const qs = Array.from({ length: n }, (_, i) => L[(start + i) % L.length]);
  const since = new Date(Date.now() - (G.done ? days[1] : days[0]) * DAY).toISOString();
  let got = 0;
  try { for (const q of qs) {
    let d = await call("search", { part: "id", q, type: "video", order: "viewCount", publishedAfter: since, regionCode: G.region || "JP", relevanceLanguage: G.lang || "ja", videoEmbeddable: "true", maxResults: 50 });
    if (!(d.items || []).length && d.pageInfo?.totalResults) d = await call("search", { part: "id", q, type: "video", order: "relevance", publishedAfter: since, regionCode: G.region || "JP", relevanceLanguage: G.lang || "ja", videoEmbeddable: "true", maxResults: 50 });
    for (const x of d.items || []) if (x.id?.videoId && !chOf[x.id.videoId]) { chOf[x.id.videoId] = tag; got++; } } }
  catch (e) { console.log(tag.name, "search stopped:", e.message); }
  console.log(tag.name, JSON.stringify(qs), "found", got);
  return n;
}
const KB = cfg.konbini || { queries: [] };   // convenience stores and the Han River: same tab and checks as travel & food
const PG = cfg.pilgrimage || { queries: [] };   // idols' places in Korea (聖地巡礼)
const HG = cfg.heritage || { queries: [] }, BG = cfg.busan_jp || { queries: [] };   // traditional Seoul, Busan
// Korean-language picks for travel spots and restaurants (Korean creators, region KR): shown on both editions, lifted on /jp
const KR = cfg.kr_reco || { queries: [] }, RECO = { name: "Korean travel & restaurant picks (search, KR)", cat: "travel", search: true, reco: true };
// These searches share the nightly YouTube quota with the global edition: at most JP_SEARCHES a night, the groups
// taking turns (a group that did not get a turn keeps its first-run size for a later night).
{ const G = [[TR, TRAVEL, [365, 60]], [BE, BEAUTY, [180, 30]], [KB, TRAVEL, [365, 60]], [PG, TRAVEL, [365, 60]], [HG, TRAVEL, [365, 60]], [BG, TRAVEL, [365, 60]]];
  let budget = +(process.env.JP_SEARCHES || 6);
  budget -= await searchGroup(KR, RECO, [365, 60], budget) || 0;   // Korean travel & restaurant picks first (priority, per David)
  const off = Math.floor(Date.now() / DAY) % G.length;
  for (let i = 0; i < G.length; i++) { const [g, tag, days] = G[(off + i) % G.length]; budget -= await searchGroup(g, tag, days, budget) || 0; } }
// Ranked actors (scripts/actors.mjs JP_ACTORS, Japanese fan ranking): Japanese uploads of their romance scenes, fan meetings,
// visits to Japan / events / fancams and fan-made videos. Actor and kind both rotate (22 actors x 7 kinds, coprime), so every
// night covers different actors and a mix of kinds; the top of the ranking comes first on the first night.
const AC = cfg.actors || { kinds: [] }, ACTS = { name: "Ranked actors: romance, fan meetings, events, fan-made (search)", cat: "actors", search: true };
{ const names = JP_ACTORS.map(a => JP_ACTOR_JA[a[0]]).filter(Boolean), K = AC.kinds || [];
  const queries = []; for (let j = 0; names.length && K.length && j < names.length * K.length; j++) queries.push(names[j % names.length] + " " + K[j % K.length]);
  await searchGroup({ ...AC, queries }, ACTS, [1095, 365]); }
// Fan uploads of the artists strongest in Japan (fancams, Japan events, airport, fan meetings, Japanese TV and music shows)
const FN = cfg.fans || { artists: {}, kinds: [] }, FANS = { name: "Japanese fan uploads (search, Japanese comments)", cat: "fans", search: true };
{ const Q = [...(FN.extra || [])]; for (const k of FN.kinds) for (const [a, q] of Object.entries(FN.artists)) Q.push(q + " " + k);   // extra first, then artists alternate
  const n = TOP_ONLY ? 0 : Math.min(CHECK ? 3 : FN.done ? (FN.per_night || 4) : (FN.first_run || 8), Q.length);
  const start = FN.done ? Math.floor(Date.now() / DAY) * n % Math.max(1, Q.length) : 0;   // the first night takes the top of the list
  const qs = Array.from({ length: n }, (_, i) => Q[(start + i) % Q.length]);
  const since = new Date(Date.now() - (FN.done ? 30 : 180) * DAY).toISOString();
  let got = 0;
  try { for (const q of qs) {
    // order=relevance: with order=viewCount YouTube answered these idol searches with no items at all (2026-10-26)
    const d = await call("search", { part: "id", q, type: "video", order: "relevance", publishedAfter: since, regionCode: "JP", relevanceLanguage: "ja", videoEmbeddable: "true", maxResults: 50 });
    if (CHECK) console.log("  fan search", JSON.stringify(q), "items", (d.items || []).length, "total", d.pageInfo?.totalResults, d.error ? JSON.stringify(d.error).slice(0, 200) : "");
    for (const x of d.items || []) if (x.id?.videoId && !chOf[x.id.videoId]) { chOf[x.id.videoId] = FANS; got++; } } }
  catch (e) { console.log("fan search stopped:", e.message); }
  console.log("fan searches", JSON.stringify(qs), "found", got); }
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
  if (c.cat === "travel") return "k";   // also the picked Korean food / travel creators
  if (c.cat === "beauty") return "b";
  if (c.cat === "actors") return jpActorKind(v.meta) === "r" ? "d" : "e";   // romance scenes to Screen; fan meetings, events, fancams, fan-made to Shows
  if (c.cat === "fans") return STAGE.test(text) ? "m" : "e";   // stage fancams to Music, airport / events / fan meetings to Shows                 // K-Travel & Food tab on /jp (K-Food elsewhere)
  if (c.cat === "music") return SHOW.test(text) ? "e" : "m";
  if ((SHOW.test(text) || idols.some(re => re.test(v.meta[0]))) && !/ドラマ/.test(v.meta[0]) && !MUSIC.test(v.meta[0])) return "e";
  if (MUSIC.test(v.meta[0])) return "m";
  if (FILM.test(text)) return "f";
  return "d";
};
const KANA = /[ぁ-んァ-ヶ]/;
const KPLACE = /韓国|ソウル|漢江|ハンガン|西村|ソチョン|付岩洞|プアムドン|鍾路|チョンノ|仁寺洞|インサドン|昌徳宮|徳寿宮|韓屋|韓服|白瀬|ヒンヨウル|ブルーラインパーク|ドローンショー|田浦|チョンポ|影島|ヨンド|海東龍宮寺|BIFF|釜山|プサン|済州|チェジュ|明洞|ミョンドン|弘大|ホンデ|聖水|ソンス|江南|カンナム|漢南|ハンナム|梨泰院|イテウォン|東大門|南大門|広蔵市場|乙支路|ウルチロ|新堂|シンダン|安国|アングク|益善洞|イクソンドン|延南|ヨンナム|望遠|マンウォン|狎鴎亭|アックジョン|新沙|カロスキル|北村|景福宮|南山|Nソウルタワー|汝矣島|ヨイド|ロッテワールド|仁川|大邱|全州|慶州|海雲台|ヘウンデ|広安里|クァンアンリ|甘川|カムチョン|西面|ソミョン|南浦|ナンポ|チャガルチ|海東竜宮寺|城山|ロンドンベーグル|london bagel|korea|seoul|busan|jeju/i;
const TRAVELW = /旅行|旅|vlog|レンタル|ヘアセット|ヘアアレンジ|体験|散策|ポジャンマチャ|屋台|聖地巡礼|聖地|行きつけ|ゆかり|推し活|ロケ地|撮影地|ピクニック|ラミョン|ラーメン|ドリンク|飲み物|組み合わせ|新商品|GS25|\bCU\b|セブンイレブン|観光|グルメ|食べ|飯|カフェ|屋台|市場|コンビニ|ホテル|おすすめ|モッパン|爆食|ランチ|ディナー|朝ごはん|焼肉|サムギョプサル|チキン|トッポギ|キンパ|ビビンバ|スンドゥブ|ケジャン|冷麺|チヂミ|ホットク|スイーツ|パン|お土産|買い物|ショッピング|オリーブヤング|散策|街歩き|ひとり旅|女子旅|家族旅行|穴場|行き方|空港|地下鉄|両替|日帰り|泊|day ?trip|travel|food|cafe/i;
const NOT_TRAVEL = /mv\b|m\/v|music video|直撮り|ファンカム|fancam|ドラマ|映画|予告|full ?ver|フル|歌ってみた|踊ってみた|cover|反応|リアクション|ニュース|news|政治|事件|事故|コリアンタウン|新大久保|鶴橋|大阪|名古屋|日本で|自宅|家で|一人暮らし|作ってみた|レシピ|再現/i;
const COSME = /オリーブヤング|オリヤン|olive ?young|올리브영|韓国コスメ|韓コス|kコスメ|k-?beauty|korean (makeup|skincare|beauty)/i;
const BEAUTYW = /購入品|爆買い|おすすめ|オススメ|新作|レビュー|ランキング|買ってよかった|使ってみた|比較|スキンケア|メイク|コスメ|クッション|リップ|ティント|美容液|クリーム|パック|日焼け止め|haul|review/i;
const NOT_BEAUTY = /ドラマ|映画|予告|直撮り|fancam|ファンカム|\bmv\b|m\/v|ニュース|news|株|投資|決算/i;
const beautyOK = v => { const t = v.meta[0] + " " + v.meta[5].join(" ");
  return KANA.test(v.meta[0]) && COSME.test(t) && BEAUTYW.test(t) && !NOT_BEAUTY.test(v.meta[0]) && v.meta[6] > 0 && v.meta[6] <= 40 * 60; };
const RECO_W = /여행|여행지|가볼만한|가볼 ?만한|추천|맛집|식당|카페|코스|투어|핫플|먹방|음식|브이로그|vlog|travel|trip|food|restaurant|must ?visit|places to/i;
const RECO_NOT = /\bmv\b|m\/v|직캠|fancam|드라마|예고|teaser|trailer|뉴스|news|사건|사고|일본|도쿄|오사카|후쿠오카|대만|베트남|태국|유럽|미국/i;
const recoOK = v => { const t = v.meta[0] + " " + v.meta[5].join(" ");
  return (/[가-힣]/.test(t) || /korea|seoul|busan/i.test(t)) && RECO_W.test(t) && !RECO_NOT.test(v.meta[0]) && v.meta[6] > 0 && v.meta[6] <= 40 * 60; };
const travelOK = v => KANA.test(v.meta[0]) && (KPLACE.test(v.meta[0] + " " + v.meta[5].join(" ")) || (/聖地|行きつけ|ゆかり|ロケ地|撮影地/.test(v.meta[0]) && idols.some(re => re.test(v.meta[0] + " " + v.meta[5].join(" "))))) && TRAVELW.test(v.meta[0] + " " + v.meta[5].join(" ")) && !NOT_TRAVEL.test(v.meta[0]) && v.meta[6] > 0 && v.meta[6] <= 40 * 60;
for (const id of Object.keys(chOf)) if (chOf[id].search && info[id] && info[id].meta[6] <= 180 && (info[id].meta[6] <= 60 || /#shorts?\b/i.test(info[id].meta[0] + " " + info[id].meta[5].join(" ")))) shortIds.add(id);
// fan uploads: one of the fan-search artists, not a full re-upload, and Japanese fans in the comments
const FAN_ART = JP_ARTISTS.filter(a => FN.artists && FN.artists[a[0]]);
const FULL = /full|フル(?!ー)|全編|一挙|1時間|\b1 ?hour|歌詞|lyrics?|karaoke|カラオケ|第\d+話|\bep\.? ?\d+|再アップ|\bmv\b|m\/v|music video|official (audio|video)/i;
const STAGE = /直撮り|fancam|ファンカム|ステージ|stage|ライブ|\blive\b|コンサート|ドーム|dome|Mステ|ミュージックステーション|CDTV|紅白|FNS|歌番組|パフォーマンス|performance|ツアー|tour|フェス|fes/i;
const fanArtist = v => FAN_ART.some(a => a[1].includes(v.meta[1]) || a[2].test(v.meta[0] + " " + v.meta[5].join(" ")));
async function jaComments(id) {
  try { const d = await call("commentThreads", { part: "snippet", videoId: id, maxResults: 20, order: "relevance", textFormat: "plainText" });
    return (d.items || []).filter(x => /[ぁ-んァ-ヶ]/.test(x.snippet?.topLevelComment?.snippet?.textDisplay || "")).length; } catch (e) { return 0; }
}
const jaC = {};
{ const fc = all.filter(id => chOf[id] === FANS && info[id] && info[id].usable && info[id].views >= (FN.min_views || 10000)
      && info[id].meta[6] > 0 && info[id].meta[6] <= 30 * 60 && fanArtist(info[id]) && !FULL.test(info[id].meta[0]));
  const q = [...fc]; await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const id = q.pop(); jaC[id] = await jaComments(id); } }));
  console.log("fan candidates", fc.length, "with Japanese comments", fc.filter(id => jaC[id] >= (FN.min_ja_comments || 3)).length); }
// ranked-actor uploads: one of the actors is named, not a full re-upload, at most 30 minutes
const actorOK = v => !!jpActorKind(v.meta) && !FULL.test(v.meta[0]) && v.meta[6] > 0 && v.meta[6] <= 30 * 60;
const fanOK = v => (jaC[v.id] || 0) >= (FN.min_ja_comments || 3);
const out = { videos: {}, shorts: {} }, per = {}; let skipped = 0, notKorean = 0, notTravel = 0, notFan = 0;
const cand = all.filter(id => info[id] && info[id].usable && info[id].views >= (chOf[id] === TRAVEL ? (TR.min_views || 20000) : chOf[id] === BEAUTY ? (BE.min_views || 50000) : chOf[id] === ACTS ? (AC.min_views || 10000) : chOf[id] === FANS ? (FN.min_views || 10000) : 300));
const good = new Set(), checks = [...cand];
await Promise.all(Array.from({ length: 16 }, async () => { while (checks.length) { const id = checks.pop(); if (await hasThumb(id, shortIds.has(id) ? "s" : "v")) good.add(id); } }));
for (const id of cand) {
  const v = { ...info[id], id }, c = chOf[id];
  if (!good.has(id)) { skipped++; continue; }
  if (c.korean && !korean(v)) { notKorean++; continue; }
  if (c.only && !new RegExp(c.only, "i").test(v.meta[0])) { notTravel++; continue; }   // e.g. only the 먹을텐데 episodes of 성시경's channel
  if (c === TRAVEL && !travelOK(v)) { notTravel++; continue; }
  if (c === RECO && !recoOK(v)) { notTravel++; continue; }
  if (c === BEAUTY && !beautyOK(v)) { notTravel++; continue; }
  if (c === FANS && !fanOK(v)) { notFan++; continue; }
  if (c === ACTS && !actorOK(v)) { notFan++; continue; }
  const k = cat(v), p = per[c.name || c.q] = per[c.name || c.q] || { videos: 0, shorts: 0, sample: [] };
  if (shortIds.has(id)) { out.shorts[id] = [k, v.views, 1, v.days]; p.shorts++; } else { out.videos[id] = [k, v.views, v.days, 1]; p.videos++; }
  if (p.sample.length < (CHECK ? 10 : 4)) p.sample.push(`[${k}${c.korean ? " " + why(v) : ""}${c === FANS ? " ja" + jaC[id] : ""}] ${v.meta[0].slice(0, 70)}`);
  if (!CHECK) { vmeta[id] = v.meta; if (c === RECO || c.reco) reco.add(id); else only.add(id); }   // Korean picks are not Japan-only
}
const report = Object.entries(per).map(([n, p]) => `${n}: videos ${p.videos}, shorts ${p.shorts}\n   ` + p.sample.join("\n   ")).join("\n");
console.log(report);
if (CHECK) fs.writeFileSync("jp_check.txt", report + "\n");
if (!CHECK) {
  for (const c of cfg.channels) if (c.id && (!TOP_ONLY || c.top)) c.done = true;
  if (cfg.travel && cfg.travel.ran) { cfg.travel.done = true; delete cfg.travel.ran; }
  if (cfg.beauty && cfg.beauty.ran) { cfg.beauty.done = true; delete cfg.beauty.ran; }
  if (cfg.kr_reco && cfg.kr_reco.ran) { cfg.kr_reco.done = true; delete cfg.kr_reco.ran; }
  if (cfg.konbini && cfg.konbini.ran) { cfg.konbini.done = true; delete cfg.konbini.ran; }
  if (cfg.pilgrimage && cfg.pilgrimage.ran) { cfg.pilgrimage.done = true; delete cfg.pilgrimage.ran; }
  if (cfg.heritage && cfg.heritage.ran) { cfg.heritage.done = true; delete cfg.heritage.ran; }
  if (cfg.busan_jp && cfg.busan_jp.ran) { cfg.busan_jp.done = true; delete cfg.busan_jp.ran; }
  if (cfg.fans && !TOP_ONLY) cfg.fans.done = true;
  if (cfg.actors && !TOP_ONLY) cfg.actors.done = true;
  fs.writeFileSync(CFG, JSON.stringify(cfg, null, 1) + "\n");
  fs.writeFileSync(VMETA, zlib.gzipSync(JSON.stringify(vmeta)));
  fs.writeFileSync(ONLY, JSON.stringify([...only]));
  fs.writeFileSync(RECO_F, JSON.stringify([...reco]));
  fs.writeFileSync(outPath, JSON.stringify(out));
}
const summary = JSON.stringify({ check: CHECK, channels_found: cfg.channels.filter(c => c.id).length, of: cfg.channels.length, new_candidates: all.length,
  videos: Object.keys(out.videos).length, shorts: Object.keys(out.shorts).length, not_korean: notKorean, not_on_topic: notTravel, not_fan: notFan, skipped, quota_used: used });
console.log(summary); if (CHECK) fs.appendFileSync("jp_check.txt", summary + "\n");
