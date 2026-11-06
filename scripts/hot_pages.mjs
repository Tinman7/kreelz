// Hot pages (per David 2026-11-06 19:40: "구글에서 재혼황후나 아일릿을 치면 우리 사이트가 먼저 나와야"): a page per
// moment people are searching for right now, in English (/hot/…), Japanese (/jp/hot/…) and Spanish (/es/hot/…), with
// titles aimed at the exact searches ("ILLIT Music Bank 1st win", "Remarried Empress Lee Jong Suk shorts",
// "la emperatriz divorciada clips"). Kept apart from the nightly search pages (k/) so either can change any time.
// Writes sitemap-hot.xml (for Search Console / Bing) and data/hot.json. Pinged to Bing/Naver by scripts/indexnow.mjs.
// usage: node scripts/hot_pages.mjs
import fs from "node:fs";
import zlib from "node:zlib";

const SITE = "https://kreelz.com", NOW = new Date(Date.now() + 9 * 3600e3), TODAY = NOW.toISOString().slice(0, 10);
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const shard = id => ((B64.indexOf(id[0]) * 64 + B64.indexOf(id[1])) % 256).toString(16).padStart(2, "0");
const SH = {}; const tf = (d, id) => { const k = d + shard(id); if (!(k in SH)) { try { SH[k] = JSON.parse(fs.readFileSync(`t/${d}/${shard(id)}.json`, "utf8")); } catch (e) { SH[k] = {}; } } return SH[k][id]; };
const h = fs.readFileSync("index.html", "utf8");
let vm = {}; try { vm = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/vmeta.json.gz"))); } catch (e) {}
const L = (() => { try { return JSON.parse(fs.readFileSync("live.js", "utf8").replace(/^window\.LIVE=/, "").replace(/;\s*$/, "")); } catch (e) { return {}; } })();
const dec2 = s => B64.indexOf(s[0]) * 64 + B64.indexOf(s[1]);
// every clip: id → {id, short, views, t (original), ch, ja, en, es}
const ALL = new Map();
for (const name of ["FEED", "SHORTS"]) {
  const s = (new RegExp(`const ${name} = "([^"]*)"`).exec(h) || [])[1] || "";
  for (let i = 0; i + 16 <= s.length; i += 16) {
    const id = s.slice(i, i + 11), vc = dec2(s.slice(i + 12, i + 14)), o = tf("o", id) || vm[id] || [];
    ALL.set(id, { id, short: name === "SHORTS", views: vc === 4095 ? 0 : Math.round(Math.pow(1.006, vc)), t: o[0] || (vm[id] || [])[0] || "", ch: (vm[id] || [])[2] || o[1] || "",
      ja: tf("ja", id) || "", en: tf("en", id) || "", es: tf("es", id) || "" });
  }
}
for (const x of [...(L.v || []), ...(L.s || [])]) if (!ALL.has(x[0]))
  ALL.set(x[0], { id: x[0], short: !!x[8], views: +x[2] || 0, t: x[6], ch: x[7], ja: (L.ja || {})[x[6]] || "", en: (L.en || {})[x[6]] || "", es: (L.es || {})[x[6]] || "" });
const ids = s => (String(s || "").split("|")[1] || "").match(/.{11}/g) || [];
const prio = n => (new RegExp(`const ${n} = "([^"]*)"`).exec(h) || [])[1] || "";

const ILLIT = /아일릿|ILLIT|アイリット/i, ARREST = /체포하겠어|under ?arrest|逮捕/i;
const RE_DR = /재혼 ?황후|remarried ?empress|再婚承認|再婚皇后|emperatriz divorciada/i, RE_LEADS = /신민아|이종석|shin ?min[- ]?a|lee ?jong[- ]?suk|나비에|하인리|navier|heinrey|ナビエ|ハインリ/i;
const PAGES = [
  { slug: "illit-1st-win", until: "2026-11-20",
    pick: () => { const f = [...ids(L.front), ...ids(prio("PRIO_FRONT"))];
      const more = [...ALL.values()].filter(x => ILLIT.test(x.t) && ARREST.test(x.t)).sort((a, b) => b.views - a.views).map(x => x.id);
      return [...new Set([...f, ...more])].slice(0, 60); },
    en: { title: "ILLIT 1st Win on Music Bank (Nov 6) — 'You're Under Arrest' Stage, Encore & Shorts", h1: "ILLIT's 1st win: 'You're Under Arrest' stage, encore & shorts",
      lead: "ILLIT took 1st place on KBS Music Bank on November 6, 2026 with 'You're Under Arrest' (체포하겠어). The winning stage, the encore, the official shorts and the best fancams — all in one place, updated as new clips come out." },
    ja: { title: "ILLIT（アイリット）ミュージックバンク1位（11/6）「逮捕しちゃうぞ」ステージ・アンコール・ショート", h1: "ILLIT（アイリット）ミュージックバンク1位！「逮捕しちゃうぞ」ステージ・アンコール・ショートまとめ",
      lead: "ILLITが2026年11月6日のKBS『ミュージックバンク』で「逮捕しちゃうぞ（체포하겠어 / You're Under Arrest）」で1位を獲得。1位のステージ、アンコール、公式ショート、直カムを日本語タイトルでまとめてチェック。新しいクリップが出るたびに更新します。" },
    es: { title: "ILLIT gana en Music Bank (6 nov) — 'You're Under Arrest': escenario, encore y shorts", h1: "ILLIT gana el 1.er lugar: 'You're Under Arrest' en vivo, encore y shorts",
      lead: "ILLIT ganó el primer lugar en Music Bank de KBS el 6 de noviembre de 2026 con 'You're Under Arrest' (체포하겠어). El escenario ganador, el encore, los shorts oficiales y los mejores fancams, todo en un solo lugar y actualizado en tiempo real." } },
  { slug: "the-remarried-empress", until: "2026-12-31",
    pick: () => { const s = [...ids(L.spin_en), ...ids(prio("PRIO_SPIN_EN"))];
      const lead = [...ALL.values()].filter(x => RE_DR.test(x.t) && RE_LEADS.test(x.t)).sort((a, b) => b.views - a.views).map(x => x.id);
      const rest = [...ALL.values()].filter(x => RE_DR.test(x.t)).sort((a, b) => b.views - a.views).map(x => x.id);
      return [...new Set([...s.filter(id => ALL.has(id)).sort((a, b) => ALL.get(b).views - ALL.get(a).views), ...lead, ...rest])].slice(0, 90); },
    en: { title: "The Remarried Empress — Shin Min-a × Lee Jong-suk Shorts & Best Clips", h1: "The Remarried Empress: Shin Min-a × Lee Jong-suk shorts & best clips",
      lead: "Navier and Heinrey's best moments from The Remarried Empress (재혼황후) — Shin Min-a and Lee Jong-suk's scenes, shorts, previews and making-of from official channels, with titles in English. Updated in real time." },
    ja: { title: "『再婚承認を要求します』（The Remarried Empress）シン・ミナ×イ・ジョンソク ショート・名場面まとめ", h1: "『再婚承認を要求します』（재혼황후）シン・ミナ×イ・ジョンソクのショート・名場面まとめ",
      lead: "ナビエとハインリの名場面を一気にチェック。韓国ドラマ『再婚承認を要求します（The Remarried Empress / 재혼황후）』のシン・ミナとイ・ジョンソクのシーン、ショート、予告、メイキングを日本語タイトルで紹介。リアルタイム更新。" },
    es: { title: "La emperatriz divorciada (The Remarried Empress) — Shin Min-a y Lee Jong-suk: shorts y mejores clips", h1: "La emperatriz divorciada: shorts y mejores clips de Shin Min-a y Lee Jong-suk",
      lead: "Los mejores momentos de Navier y Heinrey en La emperatriz divorciada (The Remarried Empress / 재혼황후): escenas, shorts, avances y making-of de Shin Min-a y Lee Jong-suk, de canales oficiales y con títulos en español. Se actualiza en tiempo real." } },
];
const ED = {
  en: { dir: "hot", app: "/", lang: "en", brand: "KREELZ", t: x => x.en || x.t, views: v => `${fmt(v)} views`, shorts: "Shorts", videos: "Videos", open: "Open KREELZ", upd: d => `Updated ${d}` },
  ja: { dir: "jp/hot", app: "/jp/", lang: "ja", brand: "KREELZ JAPAN", t: x => x.ja || x.t, views: v => `${fmt(v)}回視聴`, shorts: "ショート", videos: "動画", open: "KREELZ JAPANを開く", upd: d => `${d} 更新` },
  es: { dir: "es/hot", app: "/", lang: "es", brand: "KREELZ", t: x => x.es || x.en || x.t, views: v => `${fmt(v)} vistas`, shorts: "Shorts", videos: "Videos", open: "Abrir KREELZ", upd: d => `Actualizado ${d}` },
};
function fmt(v) { return v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : v >= 1e3 ? Math.round(v / 1e3) + "K" : String(v); }
const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const url = (ed, slug) => `${SITE}/${ED[ed].dir}/${slug}/`;
const urls = [], hot = [];
for (const P of PAGES) {
  if (TODAY > P.until) { for (const ed of Object.keys(ED)) fs.rmSync(`${ED[ed].dir}/${P.slug}`, { recursive: true, force: true }); continue; }
  const list = P.pick().map(id => ALL.get(id)).filter(Boolean);
  if (!list.length) continue;
  for (const ed of Object.keys(ED)) {
    const E = ED[ed], T = P[ed];
    const card = x => `<a class="card${x.short ? " sh" : ""}" href="${E.app}?${x.short ? "s" : "v"}=${x.id}"><img src="https://i.ytimg.com/vi/${x.id}/${x.short ? "hqdefault" : "mqdefault"}.jpg" alt="" loading="lazy" width="320" height="${x.short ? 568 : 180}"><b>${esc(E.t(x).replace(/#\S+/g, "").trim() || x.t)}</b><small>${esc([x.ch, x.views > 0 ? E.views(x.views) : ""].filter(Boolean).join(" · "))}</small></a>`;
    const S = list.filter(x => x.short), V = list.filter(x => !x.short);
    const alt = Object.keys(ED).map(o => `<link rel="alternate" hreflang="${ED[o].lang}" href="${url(o, P.slug)}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${url("en", P.slug)}">`;
    const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: T.title, description: T.lead, url: url(ed, P.slug), inLanguage: E.lang, dateModified: TODAY,
      mainEntity: { "@type": "ItemList", itemListElement: list.slice(0, 30).map((x, i) => ({ "@type": "ListItem", position: i + 1, url: `https://www.youtube.com/watch?v=${x.id}`, name: E.t(x) })) } };
    const img = (V[0] || S[0]);
    const html = `<!doctype html><html lang="${E.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(T.title)} | ${E.brand}</title><meta name="description" content="${esc(T.lead)}"><link rel="canonical" href="${url(ed, P.slug)}">
${alt}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(T.title)}"><meta property="og:description" content="${esc(T.lead)}"><meta property="og:url" content="${url(ed, P.slug)}">
<meta property="og:image" content="https://i.ytimg.com/vi/${img.id}/hqdefault.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<style>:root{--bg:#0f0e17;--fg:#ecebf3;--mute:#a7a5b8;--card:#1a1926;--acc:${ed === "ja" ? "#E2457A" : "#7c5cff"}}@media (prefers-color-scheme:light){:root{--bg:#fff;--fg:#17161f;--mute:#5b5a6a;--card:#f3f2f8}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Hiragino Sans","Noto Sans JP",sans-serif}
main{max-width:1100px;margin:0 auto;padding:20px 16px 56px}header{display:flex;justify-content:space-between;align-items:center;gap:12px}header a.brand{font-weight:800;letter-spacing:.04em;color:var(--fg);text-decoration:none}
.go{background:var(--acc);color:#fff;border-radius:999px;padding:8px 16px;text-decoration:none;font-weight:700;font-size:14px}h1{font-size:1.5rem;line-height:1.3;margin:18px 0 6px}.lead{color:var(--mute);max-width:780px}.upd{font-size:12px;color:var(--mute)}
h2{font-size:1.1rem;margin:26px 0 10px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}.grid.s{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
.card{display:block;color:var(--fg);text-decoration:none;background:var(--card);border-radius:12px;overflow:hidden}.card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}.card.sh img{aspect-ratio:9/16}
.card b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13.5px;padding:8px 10px 2px}.card small{display:block;color:var(--mute);font-size:12px;padding:0 10px 10px}
nav{margin-top:36px;font-size:13px;display:flex;gap:14px;flex-wrap:wrap}nav a{color:var(--acc)}</style></head><body><main>
<header><a class="brand" href="${E.app}">${E.brand}</a><a class="go" href="${E.app}">${esc(E.open)} →</a></header>
<h1>${esc(T.h1)}</h1><p class="lead">${esc(T.lead)}</p><p class="upd">${esc(E.upd(TODAY))} · ${list.length} clips</p>
${S.length ? `<h2>${E.shorts}</h2><div class="grid s">${S.map(card).join("")}</div>` : ""}
${V.length ? `<h2>${E.videos}</h2><div class="grid">${V.map(card).join("")}</div>` : ""}
<nav>${Object.keys(ED).filter(o => o !== ed).map(o => `<a href="${url(o, P.slug)}" hreflang="${ED[o].lang}">${o === "ja" ? "日本語" : o === "es" ? "Español" : "English"}</a>`).join("")}<a href="${E.app}">${esc(E.open)}</a></nav>
</main></body></html>
`;
    fs.mkdirSync(`${E.dir}/${P.slug}`, { recursive: true });
    fs.writeFileSync(`${E.dir}/${P.slug}/index.html`, html);
    urls.push(url(ed, P.slug));
  }
  hot.push({ slug: P.slug, until: P.until, clips: list.length, en: P.en.title, urls: Object.keys(ED).map(ed => url(ed, P.slug)) });
}
fs.writeFileSync("sitemap-hot.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u}</loc><lastmod>${TODAY}</lastmod><changefreq>hourly</changefreq><priority>0.9</priority></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync("data/hot.json", JSON.stringify({ updated: new Date().toISOString(), pages: hot }, null, 1) + "\n");
console.log(JSON.stringify(hot.map(p => [p.slug, p.clips])));
