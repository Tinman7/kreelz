// Region editions of the one shared page. kreelz.com/jp is index.html with data-region="jp" (Japanese by default,
// Japan-first artist/actor order, Japan look) and Japanese search/share tags. Run after every change to index.html.
// usage: node scripts/region.mjs index.html
import fs from "node:fs";
const site = process.argv[2] || "index.html";
const src = fs.readFileSync(site, "utf8");

const EDITIONS = [{
  dir: "jp",
  lang: "ja",
  region: "jp",
  title: "KREELZ JAPAN｜K-POP・韓国ドラマ・バラエティの公式動画とショート",
  description: "KREELZ JAPAN — K-POP、韓国ドラマ、韓国映画、バラエティ、ビューティー、Kフードの公式動画とショートを毎日0時（日本時間）に更新。登録不要・無料。",
  ogTitle: "KREELZ JAPAN — 韓国エンタメのショート＆動画を毎日",
  ogDescription: "Stray Kids、SEVENTEEN、ENHYPEN、&TEAMから人気俳優のロマンス名場面まで。毎日0時に新着。",
  url: "https://kreelz.com/jp/",
  badge: "JAPAN",
}];

const swap = (h, re, to, what) => { if (!re.test(h)) throw new Error("region.mjs: missing " + what); return h.replace(re, to); };
const attr = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

for (const e of EDITIONS) {
  let h = src;
  h = swap(h, /<html lang="[^"]*">/, `<html lang="${e.lang}" data-region="${e.region}">`, "<html>");
  h = swap(h, /<title>[^<]*<\/title>/, `<title>${attr(e.title)}</title>`, "<title>");
  h = swap(h, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(e.description)}">`, "description");
  h = swap(h, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr(e.ogTitle)}">`, "og:title");
  h = swap(h, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attr(e.ogDescription)}">`, "og:description");
  h = swap(h, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${e.url}">\n<meta property="og:locale" content="ja_JP">`, "og:url");
  h = swap(h, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${e.url}">`, "canonical");
  // edition badge after the wordmark (the tagline itself comes from the Japanese UI text)
  h = swap(h, /KREELZ<small data-i18n="tagline">/, `KREELZ<b class="rg">${e.badge}</b><small data-i18n="tagline">`, "logo");
  // the edition's own footer topic links (written by scripts/seo.mjs) are kept from the current copy
  const TOP = /<!--topics-->[\s\S]*?<!--\/topics-->/;
  try { const old = (TOP.exec(fs.readFileSync(`${e.dir}/index.html`, "utf8")) || [])[0]; if (old && TOP.test(h)) h = h.replace(TOP, () => old); } catch (err) {}
  fs.mkdirSync(e.dir, { recursive: true });
  fs.writeFileSync(`${e.dir}/index.html`, h);
  console.log(`${e.dir}/index.html written (${(h.length / 1e6).toFixed(2)} MB)`);
}
