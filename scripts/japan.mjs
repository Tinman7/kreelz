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
const chOf = {}, shortIds = new Set(), seenCh = new Set();
for (const c of cfg.channels) {
  if (!c.id || (TOP_ONLY && !c.top)) continue;
  if (seenCh.has(c.id)) { console.log("same channel listed twice, skipped:", c.name || c.id); continue; } seenCh.add(c.id);
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
// restaurant visits only (channels with "visit": 최자로드, per David 2026-10-27): long videos must be a visit series
// (온더웨이, 다시 쓰는 최자로드 — not the 배부른 소리 talk show); shorts need a restaurant write-up in the description,
// or a restaurant / dish in the title and none of the talk-clip signs (guests' names, debates, tips, behind-the-scenes)
const VISIT = {
  ep: /온더웨이|다시 쓰는/, epNot: /배부른 소리|\[LIVE\]/,
  intro: d => d.length >= 60 && !/^#|^돼지들 안녕/.test(d),
  not: /배부른 소리|\[LIVE\]|미공개|비하인드|논란|\bVS\b|꿀팁|PPL|해명|레시피|입맛|식성|특집|많관부|고충|역사|챌린지|청문회|w\/|feat|이벤트|커밍순|공개|갑론을박|기준|후계자|스킬|특\)|ASMR|루틴|징크스|피셜|소신발언|인스타|박사|주민|홍보대사|수제자|조합|페어링|부부|남편|임신|최후|픽|거미|우찬|오승환|김용무|하입프린세스|니코|유주|돼그맨|가오가이|개코|신기루|맛타고라스|비밀이야|소주안주|JY투어|해리포터|얼미부부|최지형|바비정|성규|인피니트|조정석|이민정|손민수|민규|에스쿱스|홍어|나카메구로|하라주쿠|도쿄|오사카|일본|원조가 아니었어|먹는 법|사실상|1타|탑티어|맛 차이|짜고 치는|무슨 그런 말|맛있게 먹는|유래|주님들/i,
  place: /맛집|식당|중국집|이자카야|오마카세|카세|점심 뭐 먹는대|Seoul Classic|흑백요리사 시리즈|폭염로드|부산로드|횟집|고깃집|국밥집|순댓집|만둣집|음식점|노포집|여기가 답|여기로|명물|명소|성지|가볼|소주마시기|해장|한식당|#광고 \(|버거|케밥|해물|갈비|곰탕|대구탕|닭한마리|국밥|순대국|순댓국|막국수|콩국수|육칼|짬뽕|감자탕|쌀국수|초밥|스시|생고기|쪽갈비|장어|방어|대광어|광어회|돌돔|굴찜|비빔밥|우족탕|설렁탕|녹두전|교자|명동교자|오향가|두루치기|불고기|닭도리탕|회춘탕|마파면|뽈락|접짝뼈국|메밀|갈매기살|닭고기|볶음밥|태국 음식/,
};
const visitOK = (t, secs, d) => { d = (d || "").trim();
  if (secs > 180) return VISIT.ep.test(t) && !VISIT.epNot.test(t);
  if (VISIT.intro(d)) return true;
  return !VISIT.not.test(t) && VISIT.place.test(t); };
// food and restaurants only (channels with "food": 맛집남자 foodman, per David 2026-10-27): a dish, drink, shop or
// restaurant in the title; no shopping tips, gossip, scams or food abroad (Japan, Thailand ...)
const FOOD = /맛집|식당|가게|사장님|장인|먹|음식|요리|김치|찌개|라면|라멘|국수|냉면|떡볶이|김밥|피자|치킨|통닭|닭|곱창|고기|갈비|삼겹|수육|족발|횟집|초밥|스시|장어|복어|아구|도다리|조개|굴|오징어|꽃게|만두|국밥|짬뽕|탕수육|비빔|장사|여기 모르면|짜장|토스트|빵|카스테라|크레페|팬케이크|수플레|푸딩|케이크|디저트|빙수|아이스크림|젤리|사탕|캔디|솜사탕|호떡|꽈배기|떡|당고|로띠|오믈렛|계란말이|튀김|꼬치|두부|감자전|잡채|팥죽|주먹밥|뷔페|오마카세|버거|스테이크|우동|덮밥|카이막|과자|초코파이|커피|주스|쥬스|맥주|막걸리|쏘맥|폭탄주|와인|사케|위스키|복분자|콜라|포장마차|분식|무한리필|두끼|소스|한상|바텐더|봉봉|수박|망고|바나나|(?<![가-힣])회(?![가-힣])|횟|탕(?![가-힣])|집(?=[을이은도]|$| )/;
const NOT_FOOD = /일본(가서|에서 오|여행)|돈키호테|태국|베트남|인도에서|네팔|사무라이|린도린도|사기|물치기|할인|다이소|올리브영|추천템|여친|남편|빚|강동원|황정민|하정우|낚시|미래시대|일본 손기술/;
const foodOK = t => FOOD.test(t) && !NOT_FOOD.test(t);
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
  if (c.skip && new RegExp(c.skip, "i").test(v.meta[0])) { notTravel++; continue; }   // e.g. 최자로드's concert promos and Japan restaurants
  if (c.visit && !visitOK(v.meta[0], v.meta[6], v.desc)) { notTravel++; continue; }
  if (c.food && !foodOK(v.meta[0])) { notTravel++; continue; }
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
