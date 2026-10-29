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
    en: tfile("en", shard(id))[id] || "", ja: tfile("ja", shard(id))[id] || "", jpo: JPO.has(id) });
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
      en: (L.en || {})[x[6]] || "", ja: (L.ja || {})[x[6]] || "", jpo: false });
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
};
const ED = {
  en: { base: "/", dir: "k", lang: "en", locale: "en_US", brand: "KREELZ", artists: ARTISTS, actors: ACTORS, title: x => x.en || x.t, keep: x => !x.jpo },
  ja: { base: "/jp/", dir: "jp/k", lang: "ja", locale: "ja_JP", brand: "KREELZ JAPAN", artists: JP_ARTISTS, actors: JP_ACTORS, title: x => x.ja || x.t, keep: () => true },
};
const T = {
  en: {
    artist: n => [`${n} shorts & videos — latest clips`, `The latest ${n} shorts and videos from YouTube in one place: MVs, dance practices, fancams, behind-the-scenes and variety clips, with titles in English. Updated every day at midnight KST.`],
    actor: n => [`${n} shorts & videos — drama clips, interviews, fan meetings`, `Every new ${n} clip in one place: drama scenes, interviews, fan meetings, events and variety appearances, with titles in English. Updated every day at midnight KST.`],
    cat: (n, k) => [`${n} shorts & videos today`, `The most-watched ${n} shorts and videos of the last days, picked from official channels and creators on YouTube, with titles in English. Updated every day at midnight KST.`],
    today: () => [`Today's K-pop, K-drama & Korean shorts`, `What Korea is watching today: the most-viewed new K-pop, K-drama, variety, beauty and K-food clips of the last 48 hours, with titles in English. Updated every day at midnight KST.`],
    hub: () => [`K-pop artists, K-drama actors & categories`, `Browse KREELZ by artist, actor or category. Each page collects the latest shorts and videos from YouTube with titles in English, updated every day at midnight KST.`],
    shorts: "Shorts", videos: "Videos", updated: d => `Updated ${d} (KST)`, count: n => `${n} clips`, views: v => `${fmt(v)} views`,
    open: "Open KREELZ", artistsH: "K-pop artists", actorsH: "Actors", catsH: "Categories", todayL: "Today", hubL: "All topics",
    note: "Videos belong to their creators and play from YouTube. KREELZ picks and translates titles; it does not host any video.",
  },
  ja: {
    artist: n => [`${n}の最新ショート・動画まとめ`, `${n}の最新ショートと動画をまとめてチェック。MV、ダンス、直カム、ビハインド、バラエティなどYouTubeの人気クリップを日本語タイトルで紹介。毎日0時（日本時間）更新。`],
    actor: n => [`${n}の最新動画まとめ｜ドラマ名場面・インタビュー・ファンミ`, `${n}の新着クリップをまとめてチェック。ドラマの名場面、インタビュー、ファンミーティング、イベント、バラエティ出演などを日本語タイトルで紹介。毎日0時（日本時間）更新。`],
    cat: (n, k) => [`${n}の人気ショート・動画`, `いま見られている${n}のショートと動画を、公式チャンネルと人気クリエイターから厳選。日本語タイトルで紹介、毎日0時（日本時間）更新。`],
    today: () => [`今日の韓国エンタメ人気ショート`, `韓国でいま話題のK-POP、韓国ドラマ、バラエティ、ビューティー、グルメの新着クリップ（直近48時間）を再生回数順に。日本語タイトル付き、毎日0時（日本時間）更新。`],
    hub: () => [`アーティスト・俳優・カテゴリー一覧`, `KREELZ JAPANをアーティスト、俳優、カテゴリーから探せます。各ページはYouTubeの最新ショートと動画を日本語タイトルでまとめ、毎日0時（日本時間）に更新。`],
    shorts: "ショート", videos: "動画", updated: d => `${d} 更新（日本時間0時）`, count: n => `${n}本`, views: v => `${fmtJa(v)}回視聴`,
    open: "KREELZ JAPANを開く", artistsH: "K-POPアーティスト", actorsH: "俳優", catsH: "カテゴリー", todayL: "今日の人気", hubL: "一覧",
    note: "動画の権利は各制作者に帰属し、YouTubeから再生されます。KREELZは動画を選んでタイトルを翻訳しているだけで、動画をホスティングしていません。",
  },
};
const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : v >= 1e3 ? Math.round(v / 1e3) + "K" : String(v);
const fmtJa = v => v >= 1e8 ? (v / 1e8).toFixed(1).replace(/\.0$/, "") + "億" : v >= 1e4 ? Math.round(v / 1e4) + "万" : String(v);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const score = x => Math.max(0, x.views) / Math.pow((x.days < 0 ? 20 : x.days) + 2, 0.8);
const pick = (list, n) => ({ s: list.filter(x => x.short).sort((a, b) => score(b) - score(a)).slice(0, n), v: list.filter(x => !x.short).sort((a, b) => score(b) - score(a)).slice(0, n) });

// ---------- pages ----------
function topics(ed) {
  const E = ED[ed], pool = ALL.filter(E.keep), out = [];
  const txt = x => `${x.t} ${x.en} ${x.ja} ${x.ch}`;
  for (const a of E.artists) {
    const ch = new Set(a[1]), m = pool.filter(x => ch.has(x.chId) || a[2].test(txt(x)));
    out.push({ kind: "artist", key: a[0], slug: slug(a[0]), name: ed === "ja" ? (ARTIST_JA[a[0]] || a[0]) : a[0], list: m });
  }
  for (const a of E.actors) {
    const not = a[3] instanceof RegExp ? a[3] : null, m = pool.filter(x => a[2].test(txt(x)) && !(not && not.test(txt(x))));
    out.push({ kind: "actor", key: a[0], slug: slug(a[0]), name: ed === "ja" ? `${ACTOR_JA[a[0]] || a[0]}（${a[1]}）`.replace(/ 俳優/, "") : `${a[0]} (${a[1]})`, list: m });
  }
  for (const k of Object.keys(CAT_TXT.en)) out.push({ kind: "cat", key: k, slug: k, name: CAT_TXT[ed][k], list: pool.filter(x => x.cat === k && (x.days < 0 || x.days <= 14)) });
  out.push({ kind: "today", key: "today", slug: "today", name: T[ed].todayL, list: pool.filter(x => x.days >= 0 && x.days <= 2) });
  return out.filter(p => p.list.length >= 6);   // no thin pages
}
const PAGES = { en: topics("en"), ja: topics("ja") };
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
.card img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:10px;background:var(--soft);display:block}
.sh .card img{aspect-ratio:9/16}
.card b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13.5px;font-weight:600;line-height:1.4;margin-top:7px}
.card small{display:block;font-size:12px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card:hover b{text-decoration:underline}
footer{margin:40px 0 30px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--ink2)}
footer h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}
.links{display:flex;flex-wrap:wrap;gap:6px 14px}.links a:hover{color:var(--accent)}
.note{color:var(--muted);font-size:12px;margin-top:18px}`;

function card(ed, x) {
  const E = ED[ed], t = E.title(x), href = `${E.base}?${x.short ? "s" : "v"}=${x.id}`;
  const sub = [x.ch, x.views > 0 ? T[ed].views(x.views) : "", x.date].filter(Boolean).join(" · ");
  return `<a class="card" href="${href}"><img src="https://i.ytimg.com/vi/${x.id}/${x.short ? "hqdefault" : "mqdefault"}.jpg" alt="" loading="lazy" decoding="async" width="320" height="${x.short ? 568 : 180}"><b>${esc(t)}</b><small>${esc(sub)}</small></a>`;
}
function linksBlock(ed, cur) {
  const P = PAGES[ed], L = T[ed], grp = k => P.filter(p => p.kind === k).map(p => p.slug === cur ? `<span>${esc(p.name)}</span>` : `<a href="/${ED[ed].dir}/${p.slug}/">${esc(p.name)}</a>`).join("");
  return `<h3>${L.artistsH}</h3><div class="links">${grp("artist")}</div><h3>${L.actorsH}</h3><div class="links">${grp("actor")}</div>` +
    `<h3>${L.catsH}</h3><div class="links">${grp("today")}${grp("cat")}<a href="/${ED[ed].dir}/">${L.hubL}</a></div>`;
}
function page(ed, p) {
  const E = ED[ed], L = T[ed], isHub = !p;
  const [h1, lead] = isHub ? L.hub() : p.kind === "artist" ? L.artist(p.name) : p.kind === "actor" ? L.actor(p.name) : p.kind === "cat" ? L.cat(p.name, p.key) : L.today();
  const sel = isHub ? { s: [], v: [] } : pick(p.list, p.kind === "today" ? 36 : 24);
  const n = sel.s.length + sel.v.length, newest = isHub ? BUILT : (p.list.map(x => x.date).filter(Boolean).sort().pop() || BUILT);
  const title = `${h1}｜${E.brand}`.replace("｜", ed === "en" ? " | " : "｜");
  const self = url(ed, p && p.slug), other = ed === "en" ? "ja" : "en";
  const alt = (!p || has(other, p.slug)) ? `\n<link rel="alternate" hreflang="${ED[other].lang}" href="${url(other, p && p.slug)}">\n<link rel="alternate" hreflang="${E.lang}" href="${self}">\n<link rel="alternate" hreflang="x-default" href="${url("en", p && p.slug)}">` : "";
  const img = (sel.v[0] || sel.s[0]) ? `https://i.ytimg.com/vi/${(sel.v[0] || sel.s[0]).id}/hqdefault.jpg` : `${SITE}/apple-touch-icon.png`;
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: h1, description: lead, url: self, inLanguage: E.lang, dateModified: BUILT, isPartOf: { "@type": "WebSite", name: E.brand, url: SITE + E.base },
      ...(n ? { mainEntity: { "@type": "ItemList", numberOfItems: n, itemListElement: [...sel.v, ...sel.s].slice(0, 30).map((x, i) => ({ "@type": "ListItem", position: i + 1, name: E.title(x), url: `${SITE}${E.base}?${x.short ? "s" : "v"}=${x.id}` })) } } : {}) },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: E.brand, item: SITE + E.base }, { "@type": "ListItem", position: 2, name: L.hubL, item: url(ed) },
      ...(p ? [{ "@type": "ListItem", position: 3, name: p.name, item: self }] : [])] }] };
  const body = isHub ? `<footer style="border:0;margin-top:0;padding-top:0">${linksBlock(ed, "")}</footer>` :
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
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head>
<body>
<div class="wrap">
<header><a class="logo" href="${E.base}"><i></i>${E.brand}</a><a class="btn" href="${E.base}">${L.open}</a></header>
<nav class="crumb"><a href="${E.base}">${E.brand}</a> › <a href="/${E.dir}/">${L.hubL}</a>${p ? ` › ${esc(p.name)}` : ""}</nav>
<h1>${esc(h1)}</h1>
<p class="lead">${esc(lead)}</p>
<p class="meta">${L.updated(BUILT)}${n ? ` · ${L.count(n)}` : ""}${!isHub && newest ? ` · ${ed === "en" ? "newest" : "最新"} ${newest}` : ""}</p>
${body}
${isHub ? "" : `<footer>${linksBlock(ed, p.slug)}${ed === "ja" ? `<p class="note"><a href="https://x.com/${XJP}" target="_blank" rel="me noopener">X（旧Twitter）@${XJP}</a> で毎日の注目クリップをお知らせ</p>` : ""}<p class="note">${L.note}</p></footer>`}
</div>
</body>
</html>
`;
}

// ---------- write ----------
const written = [];
for (const ed of ["en", "ja"]) {
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
  [["today", ...PAGES[ed].filter(p => p.kind === "today")], ["artist", ...PAGES[ed].filter(p => p.kind === "artist")], ["actor", ...PAGES[ed].filter(p => p.kind === "actor")], ["cat", ...PAGES[ed].filter(p => p.kind === "cat")]]
    .map(([, ...ps]) => ps.map(p => `<a href="/${ED[ed].dir}/${p.slug}/">${esc(p.name)}</a>`).join("")).filter(Boolean).join(`<i></i>`) +
  `<a href="/${ED[ed].dir}/">${T[ed].hubL}</a>` + (ed === "ja" ? `<i></i><a href="https://x.com/${XJP}" target="_blank" rel="me noopener">X（旧Twitter）@${XJP}</a>` : "") + `</nav><!--/topics-->`;
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
  const clean = t => t.replace(/#\S+/g, "").replace(/\s*[|｜]\s*$/, "").replace(/\s+/g, " ").trim();
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
  const hot = kind => P.filter(p => p.kind === kind).map(p => ({ p, v: recent(p).reduce((a, x) => a + Math.max(0, x.views), 0), n: recent(p).length }))
    .filter(o => o.n >= 2).sort((a, b) => b.v - a.v);
  const choose = (kind, last) => { const h = hot(kind); return (h.find(o => o.p.key !== last) || h[0] || {}).p; };
  const good = t => (clean(t).match(/[\p{L}]/gu) || []).length >= 6;   // skip titles that are only symbols / hashtags
  const best = p => { const s = [...[...recent(p)].sort((a, b) => b.views - a.views), ...top(p, 5).s, ...top(p, 5).v].find(x => good(ED.ja.title(x))); return s ? ED.ja.title(s) : ""; };
  const md = BUILT.slice(5).replace("-", "/").replace(/^0/, "").replace("/0", "/");
  const posts = [];
  const today = P.find(p => p.kind === "today");
  if (today) { const t3 = [...today.list].sort((a, b) => b.views - a.views).slice(0, 3);
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
  fs.writeFileSync("data/xposts.json", JSON.stringify({ date: BUILT, artist: a && a.key, actor: ac && ac.key, posts, engage }, null, 1) + "\n");
  console.log(`data/xposts.json: ${posts.length} posts (${posts.map(p => p.len).join(", ")} / 280)`);
}

// ---------- Facebook drafts for the Philippine audience (Kreelz Page) ----------
// data/fbposts.json: English/Taglish posts for the Page, links meant for the FIRST COMMENT (Facebook cuts the reach of
// posts with links in the text), the "Top 5" card rows (drawn as an image on the admin page), a link-free question and a
// fan-group post (honest: "we made"). David posts them himself.
{
  const FB_PAGE = "https://www.facebook.com/profile.php?id=61595710154104";
  const P = PAGES.en, recent = p => p.list.filter(x => x.days >= 0 && x.days <= 2);
  const cleanT = t => t.replace(/#\S+/g, "").replace(/\s*[|｜]\s*$/, "").replace(/\s+/g, " ").trim();
  // English title: the translation, or the original when it is already mostly in Latin letters (English-language
  // translations are not made nightly — only Japanese — so Korean-only titles are left out of the Philippine posts)
  const latin = t => { const c = cleanT(t || "").replace(/@\S+/g, "").replace(/[가-힣][가-힣\s]*\(([^)]*[A-Za-z][^)]*)\)/g, "$1").replace(/\s*\(\s*[가-힣][가-힣\s]*\)|\s+[가-힣]+(?=\s)/g, "").replace(/\s+/g, " ").trim(),
    l = (c.match(/[A-Za-z]/g) || []).length, h = (c.match(/[가-힣ぁ-んァ-ヶ一-龯]/g) || []).length; return l >= 10 && h <= l * 0.25 ? c : ""; };
  const title = x => latin(x.en) || latin(x.t);
  const enOK = x => !!title(x);
  const cut = (t, n) => t.length > n ? t.slice(0, n - 1).trim() + "…" : t;
  let prev = {}; try { prev = JSON.parse(fs.readFileSync("data/fbposts.json", "utf8")); } catch (e) {}
  const hot = kind => P.filter(p => p.kind === kind).map(p => ({ p, v: recent(p).reduce((a, x) => a + Math.max(0, x.views), 0), n: recent(p).length }))
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
      text: `🚨 ${a.key} is trending today!\n${b ? `\nLatest: “${cut(title(b), 80)}”\n` : ""}\nAll the newest ${a.key} shorts & videos in one place — updated every midnight 🇰🇷\nLink sa comments 👇\n\n${tag(a.key)} #KPop #Kreelz`,
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
    text: `Hi K-fam! 👋 We made a free site that collects the latest K-pop & K-drama shorts in one place, updated every midnight (KST) — no sign-up.\n\nHere's today's ${a.key} page: ${url("en", a.slug)}\n\nFeedback welcome! 💜` };
  out.posts.sort((x, y) => x.kst.localeCompare(y.kst));
  out.artist = a && a.key; out.actor = ac && ac.key;
  fs.writeFileSync("data/fbposts.json", JSON.stringify(out, null, 1) + "\n");
  console.log(`data/fbposts.json: ${out.posts.length} posts, card ${out.card ? out.card.rows.length : 0} rows`);
}
