// Search pages: small static HTML pages that search engines can read without running the 3 MB app — one per priority
// artist, focus actor and category, plus "today", for both editions (kreelz.com/k/… in English, kreelz.com/jp/k/… in
// Japanese) — and sitemap.xml + robots.txt. Each card opens the clip in the app (/?s=<id> short, /?v=<id> video).
// Also writes the crawlable topic links into the footer of both app pages (between <!--topics--> markers).
// Runs in the nightly refresh after scripts/region.mjs, so the pages change only at 00:00 KST with the rest of the site.
// usage: node scripts/seo.mjs            (reads index.html, live.js, t/, data/vmeta.json.gz)
import fs from "node:fs";
import zlib from "node:zlib";
import { ARTISTS, JP_ARTISTS } from "./hybe.mjs";
import { ACTORS, JP_ACTORS, JP_ACTOR_JA } from "./actors.mjs";
import { MIN, EXTRA_GROUPS, MEMBERS, EXTRA_ACTORS, DRAMAS, NOT } from "./seo_topics.mjs";

const SITE = "https://kreelz.com";
const XJP = "KREELZ77";   // the Japan edition's X account (David, 2026-10-29)
const html = fs.readFileSync("index.html", "utf8");
const str = name => (new RegExp(`const ${name} = "([^"]*)"`).exec(html) || [])[1] || "";
const BUILT = str("FEED_BUILT") || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const dec2 = s => B64.indexOf(s[0]) * 64 + B64.indexOf(s[1]);
const FCAT = { d: "drama", f: "film", m: "music", b: "beauty", k: "food", e: "variety" };
const JPO = new Set(); { const s = str("PRIO_JPO"); for (let i = 0; i + 11 <= s.length; i += 11) JPO.add(s.slice(i, i + 11)); }

// ---------- titles ----------
const shard = id => ((B64.indexOf(id[0]) * 64 + B64.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
const shards = {};
const tfile = (dir, sh) => { const k = dir + sh; if (!(k in shards)) { try { shards[k] = JSON.parse(fs.readFileSync(`t/${dir}/${sh}.json`, "utf8")); } catch (e) { shards[k] = {}; } } return shards[k]; };
let vmeta = {}; try { vmeta = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz")).toString()); } catch (e) {}

// ---------- catalogue ----------
const items = new Map();
const day = d => new Date(Date.parse(BUILT + "T00:00:00Z") - d * 864e5).toISOString().slice(0, 10);
function add(id, c, views, days, short) {
  const cat = FCAT[c.toLowerCase()]; if (!cat || items.has(id)) return;
  const o = tfile("o", shard(id))[id] || [], vm = vmeta[id] || [];
  const t = o[0] || vm[0] || ""; if (!t) return;
  items.set(id, { id, cat, short, views, days, date: days >= 0 ? day(days) : "", t, ch: o[1] || vm[2] || "", chId: vm[1] || "",
    en: tfile("en", shard(id))[id] || "", ja: tfile("ja", shard(id))[id] || "", es: tfile("es", shard(id))[id] || "", jpo: JPO.has(id) });
}
for (const [name, short] of [["FEED", false], ["SHORTS", true]]) {
  const s = str(name);
  for (let i = 0; i + 16 <= s.length; i += 16) {
    const vc = dec2(s.substr(i + 12, 2)), dc = dec2(s.substr(i + 14, 2));
    add(s.substr(i, 11), s[i + 11], vc === 4095 ? -1 : Math.round(Math.pow(1.006, vc) - 1), dc === 4095 ? -1 : dc, short);
  }
}
try {   // clips added during the day (live.js)
  const L = JSON.parse(fs.readFileSync("live.js", "utf8").replace(/^window\.LIVE=/, "").replace(/;\s*$/, ""));
  for (const x of [...(L.v || []), ...(L.s || [])]) {
    if (items.has(x[0]) || !FCAT[x[1]] || !x[6]) continue;
    const days = Math.max(0, Math.round((Date.parse(BUILT) - Date.parse(x[3] || BUILT)) / 864e5));
    items.set(x[0], { id: x[0], cat: FCAT[x[1]], short: !!x[8], views: +x[2] || 0, days, date: x[3] || "", t: x[6], ch: x[7] || "", chId: "",
      en: (L.en || {})[x[6]] || "", ja: (L.ja || {})[x[6]] || "", es: (L.es || {})[x[6]] || "", jpo: false });
  }
} catch (e) {}
const ALL = [...items.values()];
console.log(`catalogue: ${ALL.length} clips (${ALL.filter(x => x.short).length} shorts), built ${BUILT}`);

// ---------- editions ----------
const slug = s => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ARTIST_JA = { "BTS": "BTS（防弾少年団）", "Stray Kids": "Stray Kids（ストレイキッズ）", "TWICE": "TWICE（トゥワイス）", "TXT": "TXT（トゥバ）",
  "LE SSERAFIM": "LE SSERAFIM（ルセラフィム）", "ILLIT": "ILLIT（アイリット）", "SEVENTEEN": "SEVENTEEN（セブチ）", "ENHYPEN": "ENHYPEN（エンハイプン）",
  "&TEAM": "&TEAM（エンティーム）", "BOYNEXTDOOR": "BOYNEXTDOOR（ボイネク）", "ATEEZ": "ATEEZ（エイティーズ）", "TWS": "TWS（トゥアス）",
  "aespa": "aespa（エスパ）", "NCT WISH": "NCT WISH", "CORTIS": "CORTIS（コルティス）" };
const ACTOR_JA = { ...JP_ACTOR_JA, "Ji Sung": "チ・ソン", "Kim Seon-ho": "キム・ソンホ", "Nam Joo-hyuk": "ナム・ジュヒョク", "Woo Do-hwan": "ウ・ドファン",
  "Lee Do-hyun": "イ・ドヒョン", "Hwang In-youp": "ファン・イニョプ", "Choo Young-woo": "チュ・ヨンウ", "Lomon": "ロモン", "Lee Jong-suk": "イ・ジョンソク" };
const CAT_TXT = {
  en: { music: "K-pop", drama: "K-drama", film: "Korean film", variety: "Korean variety", beauty: "K-beauty", food: "K-food" },
  ja: { music: "K-POP", drama: "韓国ドラマ", film: "韓国映画", variety: "韓国バラエティ", beauty: "Kビューティー", food: "Kトラベル＆フード" },
  es: { music: "K-pop", drama: "K-drama (doramas)", film: "Cine coreano", variety: "Programas de variedades coreanos", beauty: "K-beauty", food: "Comida coreana" },
};
const ED = {
  en: { base: "/", dir: "k", lang: "en", locale: "en_US", brand: "KREELZ", artists: ARTISTS, actors: ACTORS, title: x => x.en || x.t, keep: x => !x.jpo },
  ja: { base: "/jp/", dir: "jp/k", lang: "ja", locale: "ja_JP", brand: "KREELZ JAPAN", artists: JP_ARTISTS, actors: JP_ACTORS, title: x => x.ja || x.t, keep: () => true },
  // Spanish search pages for Latin America (per David 2026-11-03, step 1): the global edition's clips, titles in Spanish
  es: { base: "/", dir: "es/k", lang: "es", locale: "es_LA", brand: "KREELZ", artists: ARTISTS, actors: ACTORS, title: x => x.es || x.en || x.t, keep: x => !x.jpo },
};
const EDS = ["en", "ja", "es"];
const T = {
  en: {
    artist: n => [`${n} shorts & videos — latest clips`, `The latest ${n} shorts and videos from YouTube in one place: MVs, dance practices, fancams, behind-the-scenes and variety clips, with titles in English. Updated in real time.`],
    actor: n => [`${n} shorts & videos — drama clips, interviews, fan meetings`, `Every new ${n} clip in one place: drama scenes, interviews, fan meetings, events and variety appearances, with titles in English. Updated in real time.`],
    cat: (n, k) => [`${n} shorts & videos today`, `The most-watched ${n} shorts and videos of the last days, picked from official channels and creators on YouTube, with titles in English. Updated in real time.`],
    today: () => [`Today's K-pop, K-drama & Korean shorts`, `What Korea is watching today: the most-viewed new K-pop, K-drama, variety, beauty and K-food clips of the last 48 hours, with titles in English. Updated in real time.`],
    member: n => [`${n} shorts & videos — latest clips`, `The latest shorts and videos of ${n}: stages, fancams, behind-the-scenes, lives and variety clips from YouTube, with titles in English. Updated in real time.`],
    show: n => [`${n} K-drama — best scenes, shorts & clips`, `The K-drama “${n}” in short clips: best scenes, making-of, previews, and cast interviews, from official channels on YouTube with titles in English. Updated in real time.`],
    krL: "Korean viewers", moreH: n => `${n} more clips Korea is watching`,
    newH: "Newest", newest: "newest", membersH: "Members", groupH: "Group", otherH: "Other members", dramasH: "K-dramas",
    about: (n, tot, ns, nv, n7, top) => `KREELZ has ${tot} ${n} clips right now (${ns} shorts, ${nv} videos)${n7 ? `, ${n7} of them new in the last 7 days` : ""}.${top ? ` The most watched: “${top[0]}”${top[1] > 0 ? ` (${fmt(top[1])} views)` : ""}.` : ""}`,
    titleX: (h, n, d) => `${h.split(" — ")[0]} (${n} clips · ${d})`, md: d => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    descX: (d, n, top, lead) => `Updated ${d}: ${n} clips.${top ? ` Trending: “${top[0]}”${top[1] > 0 ? ` (${fmt(top[1])} views)` : ""}.` : ""} ${lead}`,
    hub: () => [`K-pop artists, K-drama actors & categories`, `Browse KREELZ by artist, actor or category. Each page collects the latest shorts and videos from YouTube with titles in English, updated in real time.`],
    shorts: "Shorts", videos: "Videos", updated: d => `Updated ${d} (KST)`, count: n => `${n} clips`, views: v => `${fmt(v)} views`,
    open: "Open KREELZ", artistsH: "K-pop artists", actorsH: "Actors", catsH: "Categories", todayL: "Today", hubL: "All topics",
    note: "Videos belong to their creators and play from YouTube. KREELZ picks and translates titles; it does not host any video.",
    dgH: "Today in 3 minutes", dgNew: "👀 New to me", dgKnown: "✓ Knew it", dgThanks: "Thanks!", dgSub: "The 10 clips Korea watched most, each explained in a line", pastH: "Earlier days",
    day: d => [`Korean entertainment on ${d} — 10 clips in 3 minutes`, `The 10 clips Korea watched most on ${d}: K-pop, dramas on air, variety, film and food, each with a one-line explanation.`],
  },
  es: {
    artist: n => [`${n}: shorts y videos — lo más nuevo`, `Los shorts y videos más recientes de ${n} en un solo lugar: MVs, ensayos de baile, fancams, detrás de cámaras y programas de variedades, con títulos en español. Se actualiza en tiempo real.`],
    actor: n => [`${n}: shorts y videos — escenas de doramas, entrevistas y fan meetings`, `Todos los clips nuevos de ${n} en un solo lugar: escenas de doramas, entrevistas, fan meetings, eventos y programas de variedades, con títulos en español. Se actualiza en tiempo real.`],
    member: n => [`${n}: shorts y videos — lo más nuevo`, `Los shorts y videos más recientes de ${n}: presentaciones, fancams, detrás de cámaras, lives y programas de variedades de YouTube, con títulos en español. Se actualiza en tiempo real.`],
    show: n => [`${n} (dorama): mejores escenas, shorts y clips`, `El K-drama “${n}” en clips cortos: mejores escenas, making-of, avances y entrevistas del elenco, de los canales oficiales en YouTube con títulos en español. Se actualiza en tiempo real.`],
    cat: (n, k) => [`${n}: shorts y videos de hoy`, `Los shorts y videos de ${n} más vistos de los últimos días, elegidos de canales oficiales y creadores en YouTube, con títulos en español. Se actualiza en tiempo real.`],
    today: () => [`Hoy en Corea: shorts de K-pop, K-drama y más`, `Lo que Corea está viendo hoy: los clips nuevos más vistos de K-pop, doramas, variedades, belleza y comida de las últimas 48 horas, con títulos en español. Se actualiza en tiempo real.`],
    hub: () => [`Artistas de K-pop, actores de K-drama y categorías`, `Explora KREELZ por artista, actor o categoría. Cada página reúne los shorts y videos más recientes de YouTube con títulos en español, actualizados en tiempo real.`],
    shorts: "Shorts", videos: "Videos", updated: d => `Actualizado ${d} (hora de Corea)`, count: n => `${n} clips`, views: v => `${fmt(v)} vistas`,
    open: "Abrir KREELZ", artistsH: "Artistas de K-pop", actorsH: "Actores y actrices", catsH: "Categorías", todayL: "Hoy", hubL: "Todos los temas",
    note: "Los videos pertenecen a sus creadores y se reproducen desde YouTube. KREELZ elige los clips y traduce los títulos; no aloja ningún video.",
    krL: "Reacción en Corea", moreH: n => `${n} clips más que Corea está viendo`,
    dgH: "Hoy en Corea en 3 minutos", dgNew: "👀 No lo sabía", dgKnown: "✓ Ya lo sabía", dgThanks: "¡Gracias!", dgSub: "Los 10 clips más vistos en Corea, cada uno explicado en una línea", pastH: "Días anteriores",
    newH: "Lo más nuevo", membersH: "Integrantes", groupH: "Grupo", otherH: "Otros integrantes", dramasH: "K-dramas", newest: "más reciente",
    about: (n, tot, ns, nv, n7, top) => `KREELZ tiene ahora ${tot} clips de ${n} (${ns} shorts, ${nv} videos)${n7 ? `, ${n7} nuevos en los últimos 7 días` : ""}.${top ? ` El más visto: “${top[0]}”${top[1] > 0 ? ` (${fmt(top[1])} vistas)` : ""}.` : ""}`,
    titleX: (h, n, d) => `${h.split(" — ")[0]} (${n} clips · ${d})`, md: d => `${+d.slice(8, 10)} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][+d.slice(5, 7) - 1]}`,
    descX: (d, n, top, lead) => `Actualizado ${d}: ${n} clips.${top ? ` Tendencia: “${top[0]}”${top[1] > 0 ? ` (${fmt(top[1])} vistas)` : ""}.` : ""} ${lead}`,
  },
  ja: {
    artist: n => [`${n}の最新ショート・動画まとめ`, `${n}の最新ショートと動画をまとめてチェック。MV、ダンス、直カム、ビハインド、バラエティなどYouTubeの人気クリップを日本語タイトルで紹介。リアルタイム更新。`],
    actor: n => [`${n}の最新動画まとめ｜ドラマ名場面・インタビュー・ファンミ`, `${n}の新着クリップをまとめてチェック。ドラマの名場面、インタビュー、ファンミーティング、イベント、バラエティ出演などを日本語タイトルで紹介。リアルタイム更新。`],
    cat: (n, k) => [`${n}の人気ショート・動画`, `いま見られている${n}のショートと動画を、公式チャンネルと人気クリエイターから厳選。日本語タイトルで紹介、リアルタイム更新。`],
    today: () => [`今日の韓国エンタメ人気ショート`, `韓国でいま話題のK-POP、韓国ドラマ、バラエティ、ビューティー、グルメの新着クリップ（直近48時間）を再生回数順に。日本語タイトル付き、リアルタイム更新。`],
    member: n => [`${n}の最新ショート・動画まとめ`, `${n}の最新ショートと動画をまとめてチェック。ステージ、直カム、ビハインド、ライブ、バラエティなどYouTubeの人気クリップを日本語タイトルで紹介。リアルタイム更新。`],
    show: n => [`韓国ドラマ「${n}」名場面・ショート動画まとめ`, `韓国ドラマ「${n}」の名場面、メイキング、予告、キャストのインタビューなどを、公式チャンネルのショート・動画から日本語タイトルで紹介。リアルタイム更新。`],
    krL: "韓国の反応", moreH: n => `ほかにも韓国で話題の${n}本`,
    newH: "新着", newest: "最新", membersH: "メンバー", groupH: "グループ", otherH: "ほかのメンバー", dramasH: "韓国ドラマ作品",
    about: (n, tot, ns, nv, n7, top) => `${n}のクリップは現在${tot}本（ショート${ns}本・動画${nv}本）${n7 ? `、直近7日間の新着は${n7}本` : ""}です。${top ? `いちばん見られているのは「${top[0]}」${top[1] > 0 ? `（${fmtJa(top[1])}回視聴）` : ""}。` : ""}`,
    titleX: (h, n, d) => `${h.split("｜")[0]}【${d}更新・${n}本】`, md: d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`,
    descX: (d, n, top, lead) => `【${d}更新】${n}本を掲載。${top ? `いま話題：「${top[0]}」${top[1] > 0 ? `（${fmtJa(top[1])}回視聴）` : ""}。` : ""}${lead}`,
    hub: () => [`アーティスト・俳優・カテゴリー一覧`, `KREELZ JAPANをアーティスト、俳優、カテゴリーから探せます。各ページはYouTubeの最新ショートと動画を日本語タイトルでまとめ、リアルタイムで更新。`],
    shorts: "ショート", videos: "動画", updated: d => `${d} 更新`, count: n => `${n}本`, views: v => `${fmtJa(v)}回視聴`,
    open: "KREELZ JAPANを開く", artistsH: "K-POPアーティスト", actorsH: "俳優", catsH: "カテゴリー", todayL: "今日の人気", hubL: "一覧",
    note: "動画の権利は各制作者に帰属し、YouTubeから再生されます。KREELZは動画を選んでタイトルを翻訳しているだけで、動画をホスティングしていません。",
    dgH: "3分でわかる今日の韓国エンタメ", dgNew: "👀 知らなかった！", dgKnown: "✓ 知ってた", dgThanks: "ありがとう！", dgSub: "韓国でいちばん見られた10本を、ひとこと解説つきで", pastH: "過去のまとめ",
    day: d => [`${d}の韓国エンタメ 3分まとめ`, `${d}に韓国でいちばん見られたK-POP、放送中のドラマ、バラエティ、映画、グルメの10本を、ひとこと解説つきで紹介。`],
  },
};
const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : v >= 1e3 ? Math.round(v / 1e3) + "K" : String(v);
const fmtJa = v => v >= 1e8 ? (v / 1e8).toFixed(1).replace(/\.0$/, "") + "億" : v >= 1e4 ? Math.round(v / 1e4) + "万" : String(v);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const score = x => Math.max(0, x.views) / Math.pow((x.days < 0 ? 20 : x.days) + 2, 0.8);
const LASTJ = /백일의 ?거짓말|100일의 ?거짓말|100 ?Days of Deception|百日の嘘|100日の嘘|닥터 ?X|Doctor ?X|ドクター ?X/i;   // /jp rule: last in every list
const lastJ = (ed, x) => ed === "ja" && LASTJ.test(`${x.t} ${x.ja} ${x.en}`) ? 1 : 0;
const pick = (list, n, ed = "en") => { const o = (a, b) => lastJ(ed, a) - lastJ(ed, b) || score(b) - score(a);
  return { s: list.filter(x => x.short).sort(o).slice(0, n), v: list.filter(x => !x.short).sort(o).slice(0, n) }; };

// ---------- "today in 3 minutes" (scripts/digest.mjs) ----------
const DIG = {}; try { for (const f of fs.readdirSync("data/digest")) { const d = JSON.parse(fs.readFileSync(`data/digest/${f}`, "utf8")); if (d.date && d.items && d.items.length) DIG[d.date] = d; } } catch (e) {}
const DAYS_ = Object.keys(DIG).sort().reverse().slice(0, 30);
// the Japan edition keeps 100 Days of Deception and Doctor X out of its lists' first places (per David): not in its digest either
const LAST_JP = /백일의 ?거짓말|100일의 ?거짓말|100 ?Days of Deception|百日の嘘|100日の嘘|닥터 ?X|Doctor ?X|ドクター ?X/i;
const dOK = ed => x => (ed !== "ja" || !LAST_JP.test(`${x.t || ""} ${x.ja_title} ${x.en_title}`)) && (ed !== "es" || x.es);
const dItems = (ed, d) => d ? d.items.filter(dOK(ed)) : [];
const dMore = (ed, d) => d && d.more ? d.more.filter(dOK(ed)) : [];
// the digest's words for a clip, in the edition's language: [title, one line, what Korean viewers say]
const dTxt = (ed, x) => ed === "ja" ? [x.ja_title, x.ja, x.kr_ja] : ed === "es" ? [x.es_title || x.en_title, x.es || x.en, x.kr_es] : [x.en_title, x.en, x.kr_en];
// every clip explained in the last 30 days of digests: its line shows under its card on the topic pages too
const NOTES = {}; for (const k of [...DAYS_].reverse()) for (const x of [...DIG[k].items, ...(DIG[k].more || [])]) NOTES[x.id] = x;
/* "new to me / knew it" answers (4-week test, per David 2026-10-30): the same random browser id as the app (kz-vid) */
const DG_JS = ed => `document.addEventListener("click",function(e){var b=e.target.closest(".dga button");if(!b)return;var li=b.closest("li"),sec=b.closest(".dg");
if(!li||!sec||b.disabled)return;var bot=navigator.webdriver||/bot\\b|bot\\/|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent||"");
var vid="";try{vid=localStorage.getItem("kz-vid")||"";if(!vid){vid=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():"v"+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem("kz-vid",vid)}}catch(_){}
li.querySelectorAll(".dga button").forEach(function(x){x.disabled=true;x.setAttribute("aria-pressed",x===b)});b.textContent=b.textContent+" — ${T[ed].dgThanks}";
try{localStorage.setItem("kz-dg-"+li.dataset.id,b.dataset.a)}catch(_){}
if(bot||!vid)return;fetch("${"https://fvtvpjsveughnhnfjcef.supabase.co"}/rest/v1/reactions",{method:"POST",keepalive:true,headers:{apikey:"${"sb_publishable_wFuEzcauXuYWkCpgZSWJ3A_5XYvDwQ2"}","Content-Type":"application/json",Prefer:"return=minimal"},
body:JSON.stringify({visitor:vid,video_id:li.dataset.id,answer:b.dataset.a,edition:sec.dataset.ed,digest_day:sec.dataset.day})}).catch(function(){})});
document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll(".dg li[data-id]").forEach(function(li){var a=null;try{a=localStorage.getItem("kz-dg-"+li.dataset.id)}catch(_){}
if(a)li.querySelectorAll(".dga button").forEach(function(x){x.disabled=true;x.setAttribute("aria-pressed",x.dataset.a===a)})})});`;
function digestBlock(ed, d, withPast) {
  if (!d || !dItems(ed, d).length) return "";
  const L = T[ed], E = ED[ed], ja = ed === "ja";
  const row = (x, i, btn) => { const [tt, line, kr] = dTxt(ed, x);
    return `<li data-id="${x.id}"><a class="dgc" href="${E.base}?${x.short ? "s" : "v"}=${x.id}"><img src="https://i.ytimg.com/vi/${x.id}/mqdefault.jpg" alt="" loading="lazy" width="320" height="180"><span><b>${i + 1}. ${esc(tt)}</b><em>${esc(line)}</em>${kr ? `<q class="kr">💬 ${esc(L.krL)}：${esc(kr)}</q>` : ""}<small>${esc([x.ch, CAT_TXT[ed][x.cat], x.views > 0 ? L.views(x.views) : ""].filter(Boolean).join(" · "))}</small></span></a>${btn ? `<div class="dga"><button type="button" data-a="new">${L.dgNew}</button><button type="button" data-a="known">${L.dgKnown}</button></div>` : ""}</li>`; };
  const top = dItems(ed, d), li = top.map((x, i) => row(x, i, true)).join(""), more = dMore(ed, d);
  const mo = more.length ? `<h3 class="dgm">${esc(L.moreH(more.length))}</h3><ol class="dgl dgs">${more.map((x, i) => row(x, top.length + i, false)).join("")}</ol>` : "";
  const past = withPast ? DAYS_.filter(k => k !== d.date).slice(0, 14).map(k => `<a href="/${E.dir}/today/${k}/">${k}</a>`).join("") : "";
  return `<section class="dg" data-ed="${ed}" data-day="${d.date}"><h2>${esc(L.dgH)}<small>${esc(L.dgSub)} · ${d.date}</small></h2><ol class="dgl">${li}</ol>${mo}${past ? `<h3 class="dgp">${L.pastH}</h3><div class="links">${past}</div>` : ""}</section>`;
}

// ---------- pages ----------
function topics(ed) {
  const E = ED[ed], pool = ALL.filter(E.keep), out = [];
  const txt = x => `${x.t} ${x.en} ${x.ja} ${x.ch}`;
  const groups = [];
  for (const a of E.artists) {
    const ch = new Set(a[1]), m = pool.filter(x => ch.has(x.chId) || a[2].test(txt(x)));
    groups.push({ kind: "artist", key: a[0], slug: slug(a[0]), name: ed === "ja" ? (ARTIST_JA[a[0]] || a[0]) : a[0], list: m });
  }
  // more groups, members, actors and dramas: search pages only (seo_topics.mjs, per David 2026-11-03)
  for (const g of EXTRA_GROUPS) if (!groups.some(p => p.key === g[0]))
    groups.push({ kind: "artist", extra: true, key: g[0], slug: slug(g[0]), name: ed === "ja" ? g[1] : g[0], list: pool.filter(x => g[2].test(txt(x))), min: MIN });
  for (const g of groups) if (NOT[g.key]) g.list = g.list.filter(x => !NOT[g.key].test(txt(x)));
  out.push(...groups);
  for (const g of groups) for (const m of MEMBERS[g.key] || []) {
    const list = g.list.filter(x => m[2].test(txt(x)));
    out.push({ kind: "member", extra: true, key: `${g.key} ${m[0]}`, group: g.slug, gname: g.key, slug: `${g.slug}-${slug(m[0]) || "m"}`, name: ed === "ja" ? `${m[1]}（${g.key}）` : `${m[0]} (${g.key})`, short: ed === "ja" ? m[1] : m[0], list, min: MIN });
  }
  for (const a of E.actors) {
    const not = a[3] instanceof RegExp ? a[3] : null, m = pool.filter(x => a[2].test(txt(x)) && !(not && not.test(txt(x))));
    out.push({ kind: "actor", key: a[0], slug: slug(a[0]), name: ed === "ja" ? `${ACTOR_JA[a[0]] || a[0]}（${a[1]}）`.replace(/ 俳優/, "") : `${a[0]} (${a[1]})`, list: m });
  }
  for (const a of EXTRA_ACTORS) if (!E.actors.some(b => b[0] === a[0]))
    out.push({ kind: "actor", extra: true, key: a[0], slug: slug(a[0]), name: ed === "ja" ? `${a[3]}（${a[1]}）` : `${a[0]} (${a[1]})`, list: pool.filter(x => a[2].test(txt(x))), min: MIN });
  for (const d of DRAMAS) {
    if (ed === "ja" && LASTJ.test(d[0] + d[1])) continue;
    const s = slug(d[0]);
    out.push({ kind: "show", extra: true, key: d[0], slug: ["drama", "film", "music", "variety", "beauty", "food", "today"].includes(s) ? s + "-drama" : s, name: ed === "ja" ? d[1] : d[0],
      list: pool.filter(x => (x.cat === "drama" || x.cat === "variety" || x.cat === "film") && d[2].test(txt(x))), min: MIN });
  }
  for (const k of Object.keys(CAT_TXT.en)) out.push({ kind: "cat", key: k, slug: k, name: CAT_TXT[ed][k], list: pool.filter(x => x.cat === k && (x.days < 0 || x.days <= 14)) });
  out.push({ kind: "today", key: "today", slug: "today", name: T[ed].todayL, list: pool.filter(x => x.days >= 0 && x.days <= 2) });
  const seen = new Set();   // no thin pages, no two pages on one address
  return [...out.filter(p => p.list.length >= (p.min || 6) && !seen.has(p.slug) && seen.add(p.slug)), ...(ed === "es" ? [] : DAYS_.map(d => ({ kind: "day", key: d, slug: `today/${d}`, name: d, list: [] })))];   // no thin pages; one page per day of the 3-minute digest
}
const PAGES = { en: topics("en"), ja: topics("ja"), es: topics("es") };
const has = (ed, s) => PAGES[ed].some(p => p.slug === s);
const url = (ed, s) => `${SITE}/${ED[ed].dir}/${s ? s + "/" : ""}`;

const CSS = `:root{--bg:#fff;--soft:#F5F6F8;--ink:#111318;--ink2:#3A3F4B;--muted:#7A808C;--line:#ECEEF2;--accent:#E8445A}
[lang=ja]{--accent:#E2457A}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 "Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,"Hiragino Sans","Noto Sans JP",Meiryo,sans-serif;padding:0 max(16px,env(safe-area-inset-left))}
a{color:inherit;text-decoration:none}.wrap{max-width:1100px;margin:0 auto}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 0 14px;border-bottom:1px solid var(--line)}
.logo{display:flex;align-items:center;gap:8px;font-weight:800;font-size:20px;letter-spacing:-.03em}.logo i{width:8px;height:8px;border-radius:50%;background:var(--accent)}
.btn{font-weight:700;font-size:13.5px;background:var(--ink);color:#fff;border-radius:999px;padding:8px 14px;white-space:nowrap}
nav.crumb{font-size:12.5px;color:var(--muted);margin:16px 0 4px}nav.crumb a:hover{color:var(--ink)}
h1{font-size:clamp(22px,4vw,32px);line-height:1.2;letter-spacing:-.02em;margin:4px 0 10px}
.lead{color:var(--ink2);max-width:760px;margin:0 0 6px}.meta{font-size:12.5px;color:var(--muted);margin:0 0 22px}
h2{font-size:17px;margin:26px 0 12px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.grid.sh{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
.grid.nw{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.card img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:10px;background:var(--soft);display:block}
.sh .card img{aspect-ratio:9/16}
.card b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13.5px;font-weight:600;line-height:1.4;margin-top:7px}
.card small{display:block;font-size:12px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card:hover b{text-decoration:underline}
footer{margin:40px 0 30px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--ink2)}
footer h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}
.links{display:flex;flex-wrap:wrap;gap:6px 14px}.links a:hover{color:var(--accent)}
.note{color:var(--muted);font-size:12px;margin-top:18px}
.about{color:var(--ink2);max-width:760px;margin:0 0 6px}.rel{font-size:13.5px;margin:0 0 8px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}.rel b{font-size:12px;color:var(--muted);font-weight:600}.rel a{color:var(--accent)}
footer .links b{font-size:12px;color:var(--muted);font-weight:600;margin-left:6px}
.dg h2 small{display:block;font-size:12.5px;font-weight:500;color:var(--muted);margin-top:4px}.dgl{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.dgc{display:grid;grid-template-columns:168px 1fr;gap:12px;align-items:start;padding:10px;border:1px solid var(--line);border-radius:14px}.dgc:hover{border-color:var(--ink2)}
.dgc img{width:100%;height:auto;aspect-ratio:16/9;display:block;object-fit:cover;border-radius:9px;background:var(--soft)}.dgc b{display:block;font-size:15px;line-height:1.35}
.dgc em{display:block;font-style:normal;color:var(--ink2);font-size:13.5px;margin-top:4px}.dgc small{display:block;color:var(--muted);font-size:12px;margin-top:5px}
.dgc q.kr{display:block;quotes:none;font-size:12.5px;color:var(--ink2);background:var(--soft);border-radius:8px;padding:5px 8px;margin-top:6px}
h3.dgm{font-size:15px;margin:26px 0 10px}.dgs .dgc{grid-template-columns:128px 1fr}.dgs .dgc b{font-size:14px}
.card i.nt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-style:normal;font-size:12.5px;color:var(--ink2);line-height:1.4;margin-top:4px}.card i.nt span{color:var(--muted)}
.dgp{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:18px 0 6px}
@media(max-width:560px){.dgc{grid-template-columns:112px 1fr;gap:10px;padding:8px}.dgc b{font-size:14px}}
.dga{display:flex;gap:8px;margin:6px 0 0 4px}.dga button{font:inherit;font-size:12.5px;font-weight:700;border:1px solid var(--line);background:#fff;color:var(--ink2);border-radius:999px;padding:5px 11px;cursor:pointer}
.dga button[aria-pressed="true"]{background:var(--ink);color:#fff;border-color:var(--ink)}.dga button:disabled{cursor:default}`;

function card(ed, x) {
  const E = ED[ed], t = E.title(x), href = `${E.base}?${x.short ? "s" : "v"}=${x.id}`;
  const sub = [x.ch, x.views > 0 ? T[ed].views(x.views) : "", x.date].filter(Boolean).join(" · ");
  const nt = NOTES[x.id] && dOK(ed)(NOTES[x.id]) ? dTxt(ed, NOTES[x.id]) : null;
  return `<a class="card" href="${href}"><img src="https://i.ytimg.com/vi/${x.id}/${x.short ? "hqdefault" : "mqdefault"}.jpg" alt="" loading="lazy" decoding="async" width="320" height="${x.short ? 568 : 180}"><b>${esc(t)}</b>${nt && nt[1] ? `<i class="nt">${esc(nt[1])}${nt[2] ? ` <span>💬 ${esc(nt[2])}</span>` : ""}</i>` : ""}<small>${esc(sub)}</small></a>`;
}
const lnk = (ed, p, cur, label) => p.slug === cur ? `<span>${esc(label || p.name)}</span>` : `<a href="/${ED[ed].dir}/${p.slug}/">${esc(label || p.name)}</a>`;
function linksBlock(ed, cur, withMembers) {
  const P = PAGES[ed], L = T[ed], grp = k => P.filter(p => p.kind === k).map(p => lnk(ed, p, cur)).join("");
  const mem = withMembers ? P.filter(p => p.kind === "artist" && P.some(m => m.kind === "member" && m.group === p.slug))
    .map(g => `<b>${esc(g.key)}</b> ` + P.filter(m => m.kind === "member" && m.group === g.slug).map(m => lnk(ed, m, cur, m.short)).join("")).join("") : "";
  const shows = grp("show");
  return `<h3>${L.artistsH}</h3><div class="links">${grp("artist")}</div>` + (mem ? `<h3>${L.membersH}</h3><div class="links">${mem}</div>` : "") +
    `<h3>${L.actorsH}</h3><div class="links">${grp("actor")}</div>` + (shows ? `<h3>${L.dramasH}</h3><div class="links">${shows}</div>` : "") +
    `<h3>${L.catsH}</h3><div class="links">${grp("today")}${grp("cat")}<a href="/${ED[ed].dir}/">${L.hubL}</a></div>`;
}
// a few lines of text of its own on each topic page: counts, the most watched clip, the members / the group
function aboutBlock(ed, p) {
  if (!["artist", "member", "actor", "show"].includes(p.kind)) return "";
  const L = T[ed], P = PAGES[ed], E = ED[ed];
  const ns = p.list.filter(x => x.short).length, n7 = p.list.filter(x => x.days >= 0 && x.days <= 7).length;
  const t = topOf(ed, p);
  let rel = "";
  const mem = P.filter(m => m.kind === "member" && m.group === p.slug);
  if (p.kind === "artist" && mem.length) rel = `<p class="rel"><b>${L.membersH}</b> ${mem.map(m => lnk(ed, m, "", m.short)).join("")}</p>`;
  if (p.kind === "member") { const g = P.find(x => x.slug === p.group), o = P.filter(m => m.kind === "member" && m.group === p.group && m.slug !== p.slug);
    rel = `<p class="rel">${g ? `<b>${L.groupH}</b> ${lnk(ed, g, "")}` : ""}${o.length ? ` <b>${L.otherH}</b> ${o.map(m => lnk(ed, m, "", m.short)).join("")}` : ""}</p>`; }
  return `<p class="about">${esc(L.about(p.name, p.list.length, ns, p.list.length - ns, n7, t))}</p>${rel}`;
}
// the clip people are watching most on a page: the most-viewed of the last 7 days, else the best of all
function topOf(ed, p) {
  const clean = x => ED[ed].title(x).replace(/#\S+/g, "").replace(/(?:\b(?:with|feat\.?|ft\.?)\s*)?@[\w.]+/gi, "").replace(/\s+l\s+[^|｜]*$|\s*[|｜]\s*[^|｜]*$/, "").replace(/\s+/g, " ").replace(/\s*\bw\/\s*$/i, "").trim();
  // a real title (a few words, not only symbols or a hashtag) of a clip that isn't held back on /jp
  const good0 = x => x.views > 0 && (clean(x).match(/[\p{L}\p{N}]{2,}/gu) || []).length >= 2 && clean(x).length >= 8 && !lastJ(ed, x);
  // in the reader's language when there is one: Japanese on /jp, no Korean-only titles in English
  const lang = x => ed === "ja" ? /[ぁ-んァ-ヶ]/.test(clean(x)) : !/[가-힣]/.test(clean(x)) && /[A-Za-z]{3}/.test(clean(x));
  const best = f => p.list.filter(x => f(x) && x.days >= 0 && x.days <= 7).sort((a, b) => b.views - a.views)[0] || p.list.filter(f).sort((a, b) => score(b) - score(a))[0];
  const r = best(x => good0(x) && lang(x)) || best(good0);
  if (!r) return null;
  let t = clean(r);
  if (t.length > 42) t = t.slice(0, 41).trim() + "…";
  return [t, r.views];
}
function page(ed, p) {
  const E = ED[ed], L = T[ed], isHub = !p;
  const [h1, lead0] = isHub ? L.hub() : p.kind === "artist" ? L.artist(p.name) : p.kind === "member" ? L.member(p.name) : p.kind === "show" ? L.show(p.name) : p.kind === "actor" ? L.actor(p.name) : p.kind === "cat" ? L.cat(p.name, p.key) : p.kind === "day" ? L.day(p.key) : L.today();
  // newest first (what changed since yesterday), then the most watched shorts and videos
  const topic = p && ["artist", "member", "actor", "show"].includes(p.kind);
  const fresh = topic ? p.list.filter(x => x.days >= 0 && x.days <= 7 && !lastJ(ed, x)).sort((a, b) => a.days - b.days || b.views - a.views).slice(0, 12) : [];
  const fr = new Set(fresh.map(x => x.id));
  const sel0 = isHub || p.kind === "day" ? { s: [], v: [] } : pick(p.list.filter(x => !fr.has(x.id)), p.kind === "today" ? 36 : 30, ed);
  const sel = { s: sel0.s, v: sel0.v };
  const n = (p && p.kind === "day" && DIG[p.key] ? DIG[p.key].items.length : 0) + fresh.length + sel.s.length + sel.v.length, newest = isHub ? BUILT : (p.list.map(x => x.date).filter(Boolean).sort().pop() || BUILT);
  // what Google shows in the results: the date and the number of clips in the title, today's most-watched clip first in the description
  const listed = topic || (p && (p.kind === "cat" || p.kind === "today"));
  const top = listed ? topOf(ed, p) : null, md = L.md(BUILT);
  const head = listed ? L.titleX(h1, n, md) : h1;
  const lead = top || topic ? L.descX(md, n, top, lead0) : lead0;
  const title = `${head}｜${E.brand}`.replace("｜", ed !== "ja" ? " | " : "｜");
  const self = url(ed, p && p.slug), others = EDS.filter(o => o !== ed && (!p || has(o, p.slug)));
  const alt = others.length ? [ed, ...others].map(o => `\n<link rel="alternate" hreflang="${ED[o].lang}" href="${url(o, p && p.slug)}">`).join("") + `\n<link rel="alternate" hreflang="x-default" href="${url(has("en", p && p.slug) || !p ? "en" : ed, p && p.slug)}">` : "";
  const im = (fresh[0] && !fresh[0].short ? fresh[0] : null) || sel.v[0] || sel.s[0] || fresh[0];
  const img = im ? `https://i.ytimg.com/vi/${im.id}/hqdefault.jpg` : `${SITE}/apple-touch-icon.png`;
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: h1, description: lead, url: self, inLanguage: E.lang, dateModified: BUILT, isPartOf: { "@type": "WebSite", name: E.brand, url: SITE + E.base },
      ...(n ? { mainEntity: { "@type": "ItemList", numberOfItems: n, itemListElement: [...fresh, ...sel.v, ...sel.s].slice(0, 30).map((x, i) => ({ "@type": "ListItem", position: i + 1, name: E.title(x), url: `${SITE}${E.base}?${x.short ? "s" : "v"}=${x.id}` })) } } : {}) },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: E.brand, item: SITE + E.base }, { "@type": "ListItem", position: 2, name: L.hubL, item: url(ed) },
      ...(p ? [{ "@type": "ListItem", position: 3, name: p.name, item: self }] : [])] }] };
  const body = isHub ? `<footer style="border:0;margin-top:0;padding-top:0">${linksBlock(ed, "", true)}</footer>` :
    (p.kind === "today" ? digestBlock(ed, DIG[DAYS_[0]], ed !== "es") : p.kind === "day" ? digestBlock(ed, DIG[p.key], true) : "") +
    (fresh.length ? `<h2>${L.newH}</h2><div class="grid nw">${fresh.map(x => card(ed, x)).join("")}</div>` : "") +
    (sel.s.length ? `<h2>${L.shorts}</h2><div class="grid sh">${sel.s.map(x => card(ed, x)).join("")}</div>` : "") +
    (sel.v.length ? `<h2>${L.videos}</h2><div class="grid">${sel.v.map(x => card(ed, x)).join("")}</div>` : "");
  return `<!doctype html>
<html lang="${E.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(lead)}">
<link rel="canonical" href="${self}">${alt}
<meta property="og:site_name" content="${E.brand}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(lead)}">
<meta property="og:url" content="${self}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${E.locale}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">${ed === "ja" ? `\n<meta name="twitter:site" content="@${XJP}">` : ""}
<meta name="theme-color" content="#FFFFFF">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>${CSS}</style>
${p && (p.kind === "today" || p.kind === "day") ? `<script>${DG_JS(ed)}</script>\n` : ""}<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head>
<body>
<div class="wrap">
<header><a class="logo" href="${E.base}"><i></i>${E.brand}</a><a class="btn" href="${E.base}">${L.open}</a></header>
<nav class="crumb"><a href="${E.base}">${E.brand}</a> › <a href="/${E.dir}/">${L.hubL}</a>${p ? ` › ${esc(p.name)}` : ""}</nav>
<h1>${esc(h1)}</h1>
<p class="lead">${esc(lead0)}</p>${isHub ? "" : aboutBlock(ed, p)}
<p class="meta">${L.updated(BUILT)}${n ? ` · ${L.count(n)}` : ""}${!isHub && newest ? ` · ${L.newest} ${newest}` : ""}</p>
${body}
${isHub ? "" : `<footer>${linksBlock(ed, p.slug)}${ed === "ja" ? `<p class="note"><a href="https://x.com/${XJP}" target="_blank" rel="me noopener">X（旧Twitter）@${XJP}</a> で毎日の注目クリップをお知らせ</p>` : ""}<p class="note">${L.note}</p></footer>`}
</div>
</body>
</html>
`;
}

// ---------- write ----------
const written = [];
for (const ed of EDS) {
  const dir = ED[ed].dir;
  fs.rmSync(dir, { recursive: true, force: true });   // pages of topics that dropped out go away
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/index.html`, page(ed, null)); written.push(url(ed));
  for (const p of PAGES[ed]) { fs.mkdirSync(`${dir}/${p.slug}`, { recursive: true }); fs.writeFileSync(`${dir}/${p.slug}/index.html`, page(ed, p)); written.push(url(ed, p.slug)); }
  console.log(`${dir}: ${PAGES[ed].length + 1} pages — ` + PAGES[ed].map(p => `${p.slug}(${p.list.length})`).join(" "));
}
fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[SITE + "/", SITE + "/jp/", ...written].map(u => `  <url><loc>${u}</loc><lastmod>${BUILT}</lastmod><changefreq>daily</changefreq></url>`).join("\n")}
</urlset>
`);
fs.writeFileSync("robots.txt", `User-agent: *
Disallow: /admin/
Disallow: /setup/
Disallow: /probe/
Disallow: /stats/

Sitemap: ${SITE}/sitemap.xml
`);

// crawlable topic links in the footer of both app pages
const block = ed => `<!--topics--><nav class="topics" aria-label="${ed === "en" ? "Browse" : "一覧"}">` +
  [["today", ...PAGES[ed].filter(p => p.kind === "today")], ["artist", ...PAGES[ed].filter(p => p.kind === "artist")], ["actor", ...PAGES[ed].filter(p => p.kind === "actor")], ["show", ...PAGES[ed].filter(p => p.kind === "show")], ["cat", ...PAGES[ed].filter(p => p.kind === "cat")]]
    .map(([, ...ps]) => ps.map(p => `<a href="/${ED[ed].dir}/${p.slug}/">${esc(p.name)}</a>`).join("")).filter(Boolean).join(`<i></i>`) +
  `<a href="/${ED[ed].dir}/">${T[ed].hubL}</a>` + (ed === "en" ? `<i></i><a href="/es/k/" hreflang="es" lang="es">Español</a>` : "") + (ed === "ja" ? `<i></i><a href="https://x.com/${XJP}" target="_blank" rel="me noopener">X（旧Twitter）@${XJP}</a>` : "") + `</nav><!--/topics-->`;
for (const [file, ed] of [["index.html", "en"], ["jp/index.html", "ja"]]) {
  let h = fs.readFileSync(file, "utf8");
  if (!/<!--topics-->[\s\S]*?<!--\/topics-->/.test(h)) { console.log(`${file}: no <!--topics--> marker, footer links skipped`); continue; }
  h = h.replace(/<!--topics-->[\s\S]*?<!--\/topics-->/, block(ed));
  fs.writeFileSync(file, h);
}
console.log(`sitemap.xml: ${written.length + 2} urls`);

// ---------- X (Twitter) drafts for the Japan account ----------
// data/xposts.json: today's ready-to-post Japanese posts built from the same pages (shown on the admin page with an
// "X에 올리기" button that opens X with the text filled in — David posts them himself; nothing is posted automatically).
{
  const xlen = s => { let n = 0; s = s.replace(/https?:\/\/\S+/g, () => { n += 23; return ""; });
    for (const ch of s) { const c = ch.codePointAt(0); n += (c <= 0x10FF || (c >= 0x2000 && c <= 0x200D) || (c >= 0x2010 && c <= 0x201F) || (c >= 0x2032 && c <= 0x2037)) ? 1 : 2; } return n; };
  const clean = t => t.replace(/(?:\b(?:with|feat\.?|ft\.?)\s*)?@[\w.]+/gi, "").replace(/#\S+/g, "").replace(/\s*[|｜]\s*$/, "").replace(/\s+/g, " ").trim();
  const cut = (t, w) => { t = clean(t); if (xlen(t) <= w) return t; let o = ""; for (const ch of t) { if (xlen(o + ch + "…") > w) break; o += ch; } return o + "…"; };
  const fit = (build, w0) => { for (let w = w0; w >= 16; w -= 4) { const s = build(w); if (xlen(s) <= 280) return s; } return build(16); };
  const TAG = { "BTS": "#BTS #防弾少年団", "Stray Kids": "#StrayKids #スキズ", "TWICE": "#TWICE", "TXT": "#TXT #トゥバ", "LE SSERAFIM": "#LE_SSERAFIM #ルセラフィム",
    "ILLIT": "#ILLIT #アイリット", "SEVENTEEN": "#SEVENTEEN #セブチ", "ENHYPEN": "#ENHYPEN", "&TEAM": "#andTEAM", "BOYNEXTDOOR": "#BOYNEXTDOOR #ボイネク",
    "ATEEZ": "#ATEEZ", "TWS": "#TWS", "aespa": "#aespa", "NCT WISH": "#NCTWISH", "CORTIS": "#CORTIS" };
  const CTAG = { music: "#KPOP", drama: "#韓国ドラマ", film: "#韓国映画", variety: "#韓国バラエティ", beauty: "#韓国コスメ #Kビューティー", food: "#韓国グルメ #韓国旅行" };
  const CEMO = { music: "🎤", drama: "📺", film: "🎬", variety: "😂", beauty: "💄", food: "🍜" };
  const actorTag = k => "#" + (ACTOR_JA[k] || k).replace(/[・ ]|俳優/g, "");
  let prev = {}; try { prev = JSON.parse(fs.readFileSync("data/xposts.json", "utf8")); } catch (e) {}
  const P = PAGES.ja, top = (p, n) => pick(p.list, n), recent = p => p.list.filter(x => x.days >= 0 && x.days <= 2);
  const hot = kind => P.filter(p => p.kind === kind && !p.extra).map(p => ({ p, v: recent(p).reduce((a, x) => a + Math.max(0, x.views), 0), n: recent(p).length }))
    .filter(o => o.n >= 2).sort((a, b) => b.v - a.v);
  const choose = (kind, last) => { const h = hot(kind); return (h.find(o => o.p.key !== last) || h[0] || {}).p; };
  const good = t => (clean(t).match(/[\p{L}]/gu) || []).length >= 6;   // skip titles that are only symbols / hashtags
  const best = p => { const s = [...[...recent(p)].sort((a, b) => b.views - a.views), ...top(p, 5).s, ...top(p, 5).v].find(x => good(ED.ja.title(x))); return s ? ED.ja.title(s) : ""; };
  const md = BUILT.slice(5).replace("-", "/").replace(/^0/, "").replace("/0", "/");
  const posts = [];
  const today = P.find(p => p.kind === "today");
  const dg = DIG[DAYS_[0]];
  if (dg && dg.date === BUILT) posts.push({ time: "12:00", label: "오늘의 3분 요약 TOP3", text: fit(w => `📰3分でわかる今日の韓国エンタメ（${md}）\n${dItems("ja", dg).slice(0, 3).map((x, i) => `${i + 1}. ${cut(x.ja_title, w)}`).join("\n")}\n解説つきの全部はこちら▶ ${url("ja", "today")}\n#韓国エンタメ #KPOP`, 64) });
  else if (today) { const t3 = [...today.list].sort((a, b) => b.views - a.views).slice(0, 3);
    posts.push({ time: "12:00", label: "오늘의 인기 TOP3", text: fit(w => `📈今日の韓国エンタメ人気クリップ（${md}）\n${t3.map((x, i) => `${i + 1}. ${cut(ED.ja.title(x), w)}`).join("\n")}\n▶ ${url("ja", "today")}\n#韓国エンタメ #KPOP`, 64) }); }
  const a = choose("artist", prev.artist);
  if (a) posts.push({ time: "19:00", label: `아티스트: ${a.key}`, text: fit(w => `🔥${a.name}の最新ショート・動画まとめ\nいま話題：${cut(best(a), w)}\n▶ ${url("ja", a.slug)}\n${TAG[a.key] || ""} #KPOP`, 110) });
  const ac = choose("actor", prev.actor);
  if (ac) posts.push({ time: "22:00", label: `배우: ${ac.key}`, text: fit(w => `🎬${(ACTOR_JA[ac.key] || ac.key).replace(/ 俳優/, "")}の最新動画まとめ\nいま話題：${cut(best(ac), w)}\nドラマ名場面・インタビュー・ファンミまで👇\n▶ ${url("ja", ac.slug)}\n${actorTag(ac.key)} #韓国俳優`, 100) });
  const ck = ["drama", "variety", "beauty", "food", "film", "music", "drama"][new Date(BUILT + "T00:00:00Z").getUTCDay() === 0 ? 6 : new Date(BUILT + "T00:00:00Z").getUTCDay() - 1];
  const cp = P.find(p => p.kind === "cat" && p.key === ck);
  if (cp) posts.push({ time: "08:00", label: `카테고리: ${CAT_TXT.ja[ck]}`, text: fit(w => `${CEMO[ck]}${CAT_TXT.ja[ck]}でいま見られているクリップ\n注目：${cut(best(cp), w)}\n▶ ${url("ja", ck)}\n${CTAG[ck]}`, 110) });
  // one post a day without a link (question to fans: replies lift the account's reach), rotating by day
  const shortA = a ? (TAG[a.key] || "").split(" ")[0] : "#KPOP", acName = ac ? (ACTOR_JA[ac.key] || ac.key).replace(/ 俳優/, "") : "";
  const QS = [
    a && `${a.key}の曲で、いま一番リピートしてるのは？🎧\nリプで教えてください！\n${TAG[a.key] || ""}`,
    a && `${a.key}を好きになったきっかけの曲・ステージは？💕\nみんなの“沼落ち”エピソード聞きたいです！\n${TAG[a.key] || ""}`,
    ac && `${acName}の出演作で、一番好きなドラマは？📺\nおすすめの名場面もぜひ！\n${actorTag(ac.key)} #韓国ドラマ`,
    `今期見てる韓国ドラマ、教えてください！📺\nおすすめも大歓迎です🙌\n#韓国ドラマ #韓ドラ好きさんと繋がりたい`,
    `最近ハマってるK-POPの曲は？🎧\n1曲だけ選ぶなら？リプで教えてください！\n#KPOP #KPOP好きさんと繋がりたい`,
    `韓国に行ったら絶対食べたいもの、何ですか？🍜\n私はまずトッポッキ…！\n#韓国グルメ #韓国旅行`,
    ac && `${acName}の一番好きなビジュアルの瞬間は？✨\n${actorTag(ac.key)} #韓国俳優`,
  ].filter(Boolean);
  const dayN = Math.floor(Date.parse(BUILT) / 864e5);
  posts.push({ time: "15:00", label: "질문 글 (링크 없음)", text: QS[dayN % QS.length] });
  // engagement kit: where to find today's Japanese posts to reply to, and short replies to adapt (David replies himself)
  const xs = q => `https://x.com/search?q=${encodeURIComponent(q + " lang:ja")}&f=live`;
  const engage = { search: [
      a && { label: `${a.key} 최신 일본어 글`, url: xs(shortA) },
      ac && { label: `${acName} 최신 일본어 글`, url: xs(actorTag(ac.key)) },
      { label: "K-POP 화제 글 (일본어)", url: xs("#KPOP") },
      { label: "한국 드라마 화제 글 (일본어)", url: xs("#韓国ドラマ") },
      { label: "팔로우할 K-POP 정보 계정 찾기", url: `https://x.com/search?q=${encodeURIComponent("K-POP 情報")}&f=user` },
    ].filter(Boolean),
    replies: [ "わかります…！何回見ても飽きないですよね🥹", "このステージ本当に最高でした🔥", "ビジュが強すぎて内容が入ってこない😂",
      "教えてくれてありがとうございます！今から見てきます👀", "この組み合わせは反則です…🫶", "次のカムバも楽しみすぎる✨" ] };
  posts.sort((x, y) => x.time.localeCompare(y.time));
  for (const p of posts) p.len = xlen(p.text);
  // 10 replies a day (per David 2026-11-04): today's most-watched clips on /jp (the 3-minute digest), each with an X search
  // for Japanese posts about it and a reply in Japanese that adds what Korean viewers say — no link (replies with links
  // look like spam). David posts them himself, spread over the day.
  const replies10 = [];
  { const L = dg && dg.date === BUILT ? [...dItems("ja", dg), ...dMore("ja", dg)] : [], seenK = new Set();
    const keyOf = x => { const t = `${x.t} ${x.ja_title} ${x.en_title}`, a = JP_ARTISTS.find(a => a[2].test(t)) || ARTISTS.find(a => a[2].test(t));
      if (a) return { k: a[0], q: (TAG[a[0]] || "#" + a[0].replace(/\W/g, "")).split(" ").slice(-1)[0] };
      const g = EXTRA_GROUPS.find(g => g[2].test(t)); if (g) return { k: g[0], q: "#" + g[0].replace(/\W/g, "") };
      const m = (x.ja_title || "").match(/[「『【]([^」』】]{2,20})[」』】]/) || (x.ja_title || "").match(/^([^\s「『【｜|・]{2,16})/);
      return m ? { k: m[1], q: m[1] } : null; };
    const end = s => { s = String(s || "").trim().replace(/[。.!！]+$/, ""); return s ? s + "！" : ""; };
    const T_KR = [kr => `韓国でも話題になってます👀 ${kr}`, kr => `韓国のコメント欄を見たら、${kr} わかる…！`, kr => `韓国でもすごく盛り上がってます！${kr}`,
      kr => `${kr} 韓国でも同じ気持ちの人が多くて嬉しい🥹`, kr => `韓国のファンの反応も最高でした😂 ${kr}`];
    const slots = ["08:30", "10:00", "11:30", "13:00", "14:30", "16:00", "17:30", "19:00", "20:30", "22:00"];
    for (const x of L) {
      if (replies10.length >= 10) break;
      if (!x.kr_ja) continue;   // the point of the reply is what Korean viewers say
      const key = keyOf(x); if (!key || seenK.has(key.k)) continue; seenK.add(key.k);
      const n = replies10.length, d = Math.floor(Date.parse(BUILT) / 864e5);
      const text = T_KR[(n + d) % T_KR.length](end(x.kr_ja));
      replies10.push({ time: slots[n], topic: cut(x.ja_title, 40), search: xs(key.q), q: key.q, video: `https://www.youtube.com/watch?v=${x.id}`, text, len: xlen(text) });
    } }
  // free-to-use card for Japanese K-content accounts (credit: KREELZ JAPAN): today's top 5 clips with Japanese titles
  const jt = x => clean(ED.ja.title(x)).replace(/\s*[|｜].*$/, "");
  const t5 = today ? [...today.list].filter(x => good(ED.ja.title(x)) && /[ぁ-んァ-ヶ一-龯]/.test(ED.ja.title(x))).sort((p, q) => q.views - p.views).slice(0, 5) : [];
  const card = t5.length ? { title: "韓国で今日いちばん見られている", big: "TOP 5", date: md, rows: t5.map(x => ({ t: jt(x).slice(0, 60), ch: x.ch, v: x.views })), url: "kreelz.com/jp", foot: "出典：KREELZ JAPAN ・ リアルタイム更新" } : null;
  fs.writeFileSync("data/xposts.json", JSON.stringify({ date: BUILT, artist: a && a.key, actor: ac && ac.key, posts, engage, card, replies10 }, null, 1) + "\n");
  console.log(`data/xposts.json: ${posts.length} posts (${posts.map(p => p.len).join(", ")} / 280)`);
}

// ---------- Facebook drafts for the Philippine audience (Kreelz Page) ----------
// data/fbposts.json: English/Taglish posts for the Page, links meant for the FIRST COMMENT (Facebook cuts the reach of
// posts with links in the text), the "Top 5" card rows (drawn as an image on the admin page), a link-free question and a
// fan-group post (honest: "we made"). David posts them himself.
{
  const FB_PAGE = "https://www.facebook.com/profile.php?id=61595710154104";
  const P = PAGES.en, recent = p => p.list.filter(x => x.days >= 0 && x.days <= 2);
  const cleanT = t => t.replace(/(?:\b(?:with|feat\.?|ft\.?)\s*)?@[\w.]+/gi, "").replace(/#\S+/g, "").replace(/\s*[|｜]\s*$/, "").replace(/\s+/g, " ").trim();
  // English title: the translation, or the original when it is already mostly in Latin letters (English-language
  // translations are not made nightly — only Japanese — so Korean-only titles are left out of the Philippine posts)
  const latin = t => { const c = cleanT(t || "").replace(/@\S+/g, "").replace(/[가-힣][가-힣\s]*\(([^)]*[A-Za-z][^)]*)\)/g, "$1").replace(/\s*\(\s*[가-힣][가-힣\s]*\)|\s+[가-힣]+(?=\s)/g, "").replace(/\s+/g, " ").trim(),
    l = (c.match(/[A-Za-z]/g) || []).length, h = (c.match(/[가-힣ぁ-んァ-ヶ一-龯]/g) || []).length; return l >= 10 && h <= l * 0.25 ? c : ""; };
  const title = x => latin(x.en) || latin(x.t);
  const enOK = x => !!title(x);
  const cut = (t, n) => t.length > n ? t.slice(0, n - 1).trim() + "…" : t;
  let prev = {}; try { prev = JSON.parse(fs.readFileSync("data/fbposts.json", "utf8")); } catch (e) {}
  const hot = kind => P.filter(p => p.kind === kind && !p.extra).map(p => ({ p, v: recent(p).reduce((a, x) => a + Math.max(0, x.views), 0), n: recent(p).length }))
    .filter(o => o.n >= 2).sort((a, b) => b.v - a.v);
  const choose = (kind, last) => { const h = hot(kind); return (h.find(o => o.p.key !== last) || h[0] || {}).p; };
  const bestOf = p => [...recent(p)].sort((a, b) => b.views - a.views).concat(pick(p.list, 5).s, pick(p.list, 5).v).find(enOK);
  const tag = s => "#" + s.replace(/[^A-Za-z0-9]/g, "");
  const dd = new Date(BUILT + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const out = { date: BUILT, page: FB_PAGE, posts: [] };
  const today = P.find(p => p.kind === "today");
  if (today) {
    const t5 = [...today.list].filter(enOK).sort((a, b) => b.views - a.views).slice(0, 5);
    out.card = { title: "TODAY'S TOP 5 K-CLIPS", date: dd, rows: t5.map(x => ({ t: cut(title(x), 70), ch: x.ch, v: x.views })), url: "kreelz.com/k/today" };
    out.posts.push({ kst: "13:00", pht: "12:00", label: "오늘의 TOP 5 (카드 이미지와 함께)", card: true,
      text: `🔥 Today's Top 5 K-Clips (${dd})\n\n${t5.map((x, i) => `${i + 1}. ${cut(title(x), 60)}`).join("\n")}\n\nAlin ang fave mo? Comment below! 👇\n\n#KPop #KDrama #Kreelz`,
      comment: `Panoorin lahat dito 👉 ${url("en", "today")}` });
  }
  const a = choose("artist", prev.artist), ac = choose("actor", prev.actor);
  if (a) { const b = bestOf(a);
    out.posts.push({ kst: "21:00", pht: "20:00", label: `메인 글: ${a.key}`,
      text: `🚨 ${a.key} is trending today!\n${b ? `\nLatest: “${cut(title(b), 80)}”\n` : ""}\nAll the newest ${a.key} shorts & videos in one place — updated in real time 🇰🇷\nLink sa comments 👇\n\n${tag(a.key)} #KPop #Kreelz`,
      comment: `Watch here 👉 ${url("en", a.slug)}` }); }
  const dayN = Math.floor(Date.parse(BUILT) / 864e5);
  const QS = [
    a && `Sino ang bias mo sa ${a.key}? 💜\nComment mo na! 👇\n\n${tag(a.key)} #KPop`,
    `Anong K-drama ang pinapanood mo ngayon? 📺\nRecommend naman diyan! 👇\n\n#KDrama #Kreelz`,
    `Kung pupunta ka sa Korea, ano ang unang kakainin mo? 🍜🇰🇷\n\n#KFood #Korea`,
    `Top 3 K-pop songs mo this week? 🎧\nShare mo sa comments! 👇\n\n#KPop #Kreelz`,
    ac && `${ac.key} fans, nasaan kayo? 🙋‍♀️\nAnong favorite drama mo niya? 😍\n\n${tag(ac.key)} #KDrama`,
    `Weekend plans: K-drama marathon o K-pop concert videos? 🍿🎤\n\n#KDrama #KPop`,
  ].filter(Boolean);
  out.posts.push({ kst: "22:30", pht: "21:30", label: "질문 글 (링크 없음)", text: QS[dayN % QS.length] });
  if (ac) { const b = bestOf(ac);
    out.posts.push({ kst: "19:00", pht: "18:00", label: `배우 글: ${ac.key}`,
      text: `😍 ${ac.key} moments you shouldn't miss${b ? `\n\n“${cut(title(b), 80)}”` : ""}\n\nDrama scenes, interviews & fan meetings — all in one place, updated daily. Link sa comments 👇\n\n${tag(ac.key)} #KDrama #Kreelz`,
      comment: `Watch here 👉 ${url("en", ac.slug)}` }); }
  if (a) out.group = { label: "팬 그룹용 (관리자 허락받은 그룹에만, 그룹당 주 1~2회)",
    text: `Hi K-fam! 👋 We made a free site that collects the latest K-pop & K-drama shorts in one place, updated in real time — no sign-up.\n\nHere's today's ${a.key} page: ${url("en", a.slug)}\n\nFeedback welcome! 💜` };
  if (a) out.groupId = { label: "인도네시아 그룹용 (Bahasa Indonesia)",
    text: `Halo K-fam! 👋 Kami bikin situs gratis yang ngumpulin shorts & video K-pop dan K-drama terbaru di satu tempat, update secara real-time — tanpa daftar, bisa pilih Bahasa Indonesia.\n\nHalaman ${a.key} hari ini: ${url("en", a.slug)}\n\nMasukan kalian sangat berarti! 💜` };
  out.posts.sort((x, y) => x.kst.localeCompare(y.kst));
  out.artist = a && a.key; out.actor = ac && ac.key;
  fs.writeFileSync("data/fbposts.json", JSON.stringify(out, null, 1) + "\n");
  console.log(`data/fbposts.json: ${out.posts.length} posts, card ${out.card ? out.card.rows.length : 0} rows`);
}

// ---------- Instagram drafts (per David 2026-11-03): the admin page's 인스타그램 section ----------
// Links in Instagram posts can't be tapped, so the traffic comes from the Story link sticker and the bio link.
// Every night: the Top 5 card for a Story (1080x1920, drawn on the admin page) and for the feed (1080x1350), in Japanese
// (from data/xposts.json) and English (from data/fbposts.json), with a caption, hashtags and the link for the sticker.
{
  const rd = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };
  const X = rd("data/xposts.json"), FB = rd("data/fbposts.json"), items = [];
  const tagsIn = list => [...new Set(list.flatMap(t => (t.match(/#[^\s#]+/g) || [])))];
  const fmtV = v => v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : v >= 1e3 ? Math.round(v / 1e3) + "K" : String(v);
  if (X && X.card && X.date === BUILT) {
    const md = X.card.date;
    const tags = [...new Set(["#KPOP", "#韓国ドラマ", "#韓ドラ", "#韓国エンタメ", "#KPOP好きな人と繋がりたい", "#韓国好きな人と繋がりたい",
      ...tagsIn(X.posts.map(p => p.text)).filter(t => !/^#(韓国グルメ|韓国旅行)$/.test(t))])].slice(0, 15);
    items.push({ ed: "ja", label: "일본어 (일본 팬용)", time: "20:00~22:00 (일본 저녁)", card: X.card,
      link: "https://kreelz.com/jp/k/today/", sticker: "今日のTOP5を見る",
      caption: `📰韓国で今日いちばん見られているK-POP・韓ドラ TOP5（${md}）\n\n${X.card.rows.map((r, i) => `${i + 1}. ${r.t}${r.v > 0 ? `（${fmtV(r.v)}回）` : ""}`).join("\n")}\n\n解説つきの全部はプロフィールのリンクから👆\nリアルタイム更新・無料\n.\n${tags.join(" ")}` });
  }
  if (FB && FB.card && FB.date === BUILT) {
    const tags = [...new Set(["#kpop", "#kdrama", "#koreandrama", "#kpopfyp", "#kdramaedits", "#kpopedit", "#kreelz",
      ...tagsIn(FB.posts.map(p => p.text)).map(t => t.toLowerCase()).filter(t => t !== "#kfood" && t !== "#korea")])].slice(0, 15);
    items.push({ ed: "en", label: "영어 (필리핀·영어권 팬용)", time: "19:00~21:00 (필리핀 18:00~20:00)", card: FB.card,
      link: "https://kreelz.com/k/today/", sticker: "See today's Top 5",
      caption: `🔥 Today's Top 5 K-Clips (${FB.card.date})\n\n${FB.card.rows.map((r, i) => `${i + 1}. ${r.t}`).join("\n")}\n\nWatch them all → link in bio 👆\nUpdated in real time · Free\n.\n${tags.join(" ")}` });
  }
  fs.writeFileSync("data/igposts.json", JSON.stringify({ date: BUILT, items }, null, 1) + "\n");
  console.log(`data/igposts.json: ${items.length} editions`);
}

// ---------- Overseas YouTube channels (per David 2026-11-03): the admin page's 해외 유튜브 협업 section ----------
// Every night: for Japan, the Philippines and Indonesia, the 3 channels of data/ytcollab.json to contact today (in turn),
// the e-mail to send them (Japanese / English / Indonesian), and today's creator kit — the "3 minutes" Top 10
// (data/digest.json) in their language, free to use with a credit line.
{
  const rd = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };
  const YC = rd("data/ytcollab.json") || { countries: {} }, DG = rd("data/digest.json");
  const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const sh = id => ((B.indexOf(id[0]) * 64 + B.indexOf(id[1])) % 256).toString(16).padStart(2, "0"), S = {};
  const tr = (lang, id) => { const k = lang + sh(id); if (!(k in S)) S[k] = rd(`t/${lang}/${sh(id)}.json`) || {}; return S[k][id] || ""; };
  const dayN = Math.floor(Date.parse(BUILT) / 864e5);
  const T = {
    JP: { subject: "【ご提案】韓国で今日いちばん見られているK-POP・韓ドラ情報を無料でご提供します（KREELZ JAPAN）",
      body: n => `${n}様\n\nはじめまして。韓国・ソウルで「KREELZ JAPAN」（https://kreelz.com/jp/）を個人で運営しているDavidと申します。いつも動画を楽しく拝見しています。\n\nKREELZ JAPANは、韓国でいま見られているK-POP・韓国ドラマ・バラエティの公式動画を、リアルタイムで日本語タイトル付きでまとめている無料サイトです。${n}様の動画づくりのお役に立てればと思い、2つご提案させてください。\n\n① 毎日の「韓国で今日いちばん見られているTOP10」（日本語タイトル・1行解説付き）を、動画の素材として自由にお使いいただけます。概要欄に「出典：KREELZ JAPAN（https://kreelz.com/jp/）」とご記載いただくことだけがお願いです。\n\n② KREELZ JAPANの「おすすめクリエイター」として、${n}様の動画をサイトで無料でご紹介させていただけませんか。再生はすべてYouTubeの埋め込みプレーヤーなので、再生数は${n}様のチャンネルに入ります。\n\n本日分の例：https://kreelz.com/jp/k/today/\n\nご興味があれば、このメールにご返信いただけると嬉しいです。お忙しいところ失礼いたしました。\n\nKREELZ JAPAN 運営 David\nkreelzkorea@gmail.com` },
    PH: { subject: "Free daily \"What Korea is watching\" Top 10 for your videos — KREELZ",
      body: n => `Hi ${n},\n\nI'm David, and I run KREELZ (https://kreelz.com) from Seoul — a free site that collects the K-pop, K-drama and variety clips Korea is watching right now, updated in real time. I enjoy your channel and thought we could help each other:\n\n1) Free material: every day we make a "Top 10 clips Korea is watching today" list with a one-line explanation of each. You're welcome to use it in your videos — all we ask is a credit line in the description: "Source: KREELZ (https://kreelz.com)".\n\n2) Featured creator: we'd love to feature your videos on KREELZ for fans in the Philippines and Southeast Asia, for free. Videos play in YouTube's own player, so every view counts for your channel.\n\nToday's list: https://kreelz.com/k/today/\n\nIf you're interested, just reply to this email. Salamat!\n\nDavid — KREELZ\nkreelzkorea@gmail.com` },
    ID: { subject: "Gratis setiap hari: Top 10 klip yang paling ditonton di Korea untuk konten kamu — KREELZ",
      body: n => `Halo ${n},\n\nSaya David, pengelola KREELZ (https://kreelz.com) dari Seoul — situs gratis yang mengumpulkan klip K-pop, drama Korea, dan variety show yang sedang ramai ditonton di Korea, diperbarui secara real-time. Saya suka konten kamu dan punya dua tawaran:\n\n1) Bahan konten gratis: setiap hari kami membuat daftar "Top 10 klip yang paling ditonton di Korea hari ini" lengkap dengan penjelasan singkat. Silakan dipakai di video kamu — cukup cantumkan di deskripsi: "Sumber: KREELZ (https://kreelz.com)".\n\n2) Kreator pilihan: kami ingin menampilkan video kamu di KREELZ untuk penggemar di Indonesia, gratis. Video diputar lewat pemutar YouTube resmi, jadi semua penayangan masuk ke channel kamu.\n\nDaftar hari ini: https://kreelz.com/k/today/\n\nKalau tertarik, balas saja email ini ya. Terima kasih!\n\nDavid — KREELZ\nkreelzkorea@gmail.com` },
  };
  const NAME = { JP: "일본", PH: "필리핀", ID: "인도네시아" };
  const out = { date: BUILT, updated: YC.updated || "", countries: {} };
  for (const cc of ["JP", "PH", "ID"]) {
    const list = YC.countries[cc] || [], n = list.length, picks = [];
    for (let k = 0; k < Math.min(3, n); k++) picks.push(list[(dayN * 3 + k) % n].id);
    let kit = null;
    if (DG && DG.items && DG.items.length) {
      const items = (cc === "JP" ? dItems("ja", DG) : DG.items).slice(0, 10);   // /jp rule: 100 Days of Deception and Doctor X left out
      if (cc === "JP") kit = { title: `📰韓国で今日いちばん見られているTOP${Math.min(10, dItems("ja", DG).length)}（${DG.date}）`, rows: items.map((x, i) => `${i + 1}. ${x.ja_title}\n   ${x.ja}`), n: items.length, link: "https://kreelz.com/jp/k/today/", credit: "出典：KREELZ JAPAN（https://kreelz.com/jp/）" };
      if (cc === "PH") kit = { title: `🔥 Top 10 clips Korea is watching today (${DG.date})`, rows: items.map((x, i) => `${i + 1}. ${x.en_title}\n   ${x.en}`), link: "https://kreelz.com/k/today/", credit: "Source: KREELZ (https://kreelz.com)" };
      if (cc === "ID") kit = { title: `🔥 Top 10 klip yang paling ditonton di Korea hari ini (${DG.date})`, rows: items.map((x, i) => `${i + 1}. ${tr("id", x.id) || x.en_title}`), link: "https://kreelz.com/k/today/", credit: "Sumber: KREELZ (https://kreelz.com)" };
      kit.text = `${kit.title}\n\n${kit.rows.join("\n")}\n\n${kit.link}\n${kit.credit}`;
    }
    out.countries[cc] = { name: NAME[cc], total: n, picks, subject: T[cc].subject, body: T[cc].body("{channel}"), kit };
  }
  fs.writeFileSync("data/ytcollab_daily.json", JSON.stringify(out, null, 1) + "\n");
  console.log(`data/ytcollab_daily.json: ${Object.entries(out.countries).map(([k, v]) => `${k} ${v.picks.length}/${v.total}`).join(", ")}`);
}
